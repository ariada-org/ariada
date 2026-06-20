// SPDX-License-Identifier: EUPL-1.2
// Tests for the Vercel deployment_status handler.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleDeploymentStatus } from '../src/handler-vercel.js';
import type { VercelDeploymentStatusEvent, ReverterVercelConfig } from '../src/types/vercel.js';
import type { LocatedFinding } from '../src/cluster.js';
import { InMemoryRateLedger } from '../src/rate-ledger.js';

function makeEvent(overrides: {
  status?: string;
  githubCommitSha?: string;
  noGithubMeta?: boolean;
} = {}): VercelDeploymentStatusEvent {
  const base: VercelDeploymentStatusEvent = {
    type: 'deployment_status',
    payload: {
      deployment: {
        id: 'dpl_fixture_001',
        url: 'http://localhost:3700',
        meta: {
          githubCommitSha: overrides.githubCommitSha ?? 'abc1234',
          githubCommitRef: 'main',
          githubOrg: 'fixture-org',
          githubRepo: 'fixture-repo',
        },
      },
      status: overrides.status ?? 'ready',
    },
  };

  if (overrides.noGithubMeta) {
    // Remove meta to simulate a manual (non-GitHub) deploy
    (base.payload.deployment as { meta?: unknown }).meta = undefined;
  }

  return base;
}

function makeConfig(overrides: Partial<ReverterVercelConfig> = {}): ReverterVercelConfig {
  return {
    cascadeBaseUrl: 'http://localhost:9001',
    githubApiBaseUrl: 'http://localhost:9002',
    maxTier: 3,
    maxPrsPerEvent: 5,
    baselineFingerprints: new Set(),
    ...overrides,
  };
}

function makeFindings(count: number, inBaseline = false): LocatedFinding[] {
  return Array.from({ length: count }, (_, i) => ({
    ruleId: 'color-contrast',
    wcagSc: '1.4.3',
    jurisdictionTags: ['WCAG21'],
    severity: 'serious' as const,
    selector: `button:nth-child(${i + 1})`,
    fingerprint: inBaseline ? `${'b'.repeat(63)}${i}` : `${'a'.repeat(63)}${i}`,
    sourceFilePath: 'src/Button.tsx',
    startLine: 14 + i * 2,
    endLine: 14 + i * 2 + 1,
  }));
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('handleDeploymentStatus — vercel trigger', () => {
  beforeEach(() => { vi.resetAllMocks(); });

  it('skips non-ready events', async () => {
    vi.stubGlobal('fetch', vi.fn());
    const result = await handleDeploymentStatus(
      makeEvent({ status: 'building' }),
      makeFindings(1),
      'token',
      makeConfig(),
      new InMemoryRateLedger(),
    );
    expect(result.acted).toBe(false);
    expect(result.openedCount).toBe(0);
  });

  it('skips events with no linked GitHub commit', async () => {
    vi.stubGlobal('fetch', vi.fn());
    const result = await handleDeploymentStatus(
      makeEvent({ noGithubMeta: true }),
      makeFindings(1),
      'token',
      makeConfig(),
      new InMemoryRateLedger(),
    );
    expect(result.acted).toBe(true);
    expect(result.skippedNoGitHubCommit).toBe(true);
    expect(result.openedCount).toBe(0);
  });

  it('filters out baseline findings and opens PR for net-new findings', async () => {
    const mockFetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      const urlStr = String(url);
      if (urlStr.includes('/contents/')) {
        const content = Buffer.from("color: '#aaa';", 'utf8').toString('base64');
        return jsonResponse({ type: 'file', content: content + '\n', encoding: 'base64' });
      }
      if (urlStr.includes('/v1/fix')) {
        return jsonResponse({
          fix_id: 'rvt_vercel_001',
          status: 'ok',
          tier_used: 1,
          diff: "-color: '#aaa';\n+color: '#595959'; /* contrast ratio 7.0:1 */",
          patched_content: "color: '#595959'; /* contrast ratio 7.0:1 */",
          risk_level: 'safe',
          unresolved_todos: [],
        });
      }
      if (urlStr.includes('/git/refs')) {
        return jsonResponse({ ref: 'refs/heads/reverter/fix-test' });
      }
      if (urlStr.includes('/contents/src') && init?.method === 'PUT') {
        return jsonResponse({ commit: { sha: 'def' } });
      }
      if (urlStr.includes('/pulls') && init?.method === 'POST') {
        return jsonResponse({
          number: 43,
          html_url: 'https://github.com/fixture-org/fixture-repo/pull/43',
          draft: true,
        });
      }
      return jsonResponse({}, 404);
    });
    vi.stubGlobal('fetch', mockFetch);

    // One baseline finding, one net-new finding
    const baselineFingerprint = 'b'.repeat(63) + '0';
    const netNewFindings = [
      ...makeFindings(1, false),  // net-new
    ];
    const config = makeConfig({
      baselineFingerprints: new Set([baselineFingerprint]),
    });

    const result = await handleDeploymentStatus(
      makeEvent(),
      netNewFindings,
      'stub-token',
      config,
      new InMemoryRateLedger(),
    );

    expect(result.acted).toBe(true);
    expect(result.targetCommitSha).toBe('abc1234');
    expect(result.openedCount).toBeGreaterThan(0);
    expect(result.skippedNoGitHubCommit).toBe(false);
  });

  it('opens PR with branch name matching reverter/fix-<rule>-<7-char-sha>', async () => {
    const branchNames: string[] = [];
    const mockFetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      const urlStr = String(url);
      if (urlStr.includes('/contents/')) {
        const content = Buffer.from("color: '#aaa';", 'utf8').toString('base64');
        return jsonResponse({ type: 'file', content: content + '\n', encoding: 'base64' });
      }
      if (urlStr.includes('/v1/fix')) {
        return jsonResponse({
          fix_id: 'rvt_vercel_001', status: 'ok', tier_used: 1,
          diff: "-color: '#aaa';\n+color: '#595959';",
          patched_content: "color: '#595959';",
          risk_level: 'safe', unresolved_todos: [],
        });
      }
      if (urlStr.includes('/git/refs')) {
        const body = JSON.parse(init?.body as string ?? '{}') as { ref?: string };
        if (body.ref) branchNames.push(body.ref.replace('refs/heads/', ''));
        return jsonResponse({ ref: body.ref ?? '' });
      }
      if (urlStr.includes('/contents/src') && init?.method === 'PUT') {
        return jsonResponse({ commit: { sha: 'def' } });
      }
      if (urlStr.includes('/pulls') && init?.method === 'POST') {
        return jsonResponse({ number: 44, html_url: 'https://github.com/...', draft: true });
      }
      return jsonResponse({}, 404);
    });
    vi.stubGlobal('fetch', mockFetch);

    await handleDeploymentStatus(
      makeEvent(),
      makeFindings(1),
      'stub-token',
      makeConfig(),
      new InMemoryRateLedger(),
    );

    expect(branchNames.length).toBeGreaterThan(0);
    const branchName = branchNames[0] ?? '';
    expect(branchName).toMatch(/^reverter\/fix-color-contrast-abc1234/);
  });

  it('PR body contains "Triggered by Vercel deployment" for Vercel-triggered PRs', async () => {
    const prBodies: string[] = [];
    const mockFetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      const urlStr = String(url);
      if (urlStr.includes('/contents/')) {
        const content = Buffer.from("color: '#aaa';", 'utf8').toString('base64');
        return jsonResponse({ type: 'file', content: content + '\n', encoding: 'base64' });
      }
      if (urlStr.includes('/v1/fix')) {
        return jsonResponse({
          fix_id: 'rvt_v1', status: 'ok', tier_used: 1,
          diff: "-color: '#aaa';\n+color: '#595959';",
          patched_content: "color: '#595959';",
          risk_level: 'safe', unresolved_todos: [],
        });
      }
      if (urlStr.includes('/git/refs')) {
        return jsonResponse({ ref: 'refs/heads/reverter/test' });
      }
      if (urlStr.includes('/contents/src') && init?.method === 'PUT') {
        return jsonResponse({ commit: { sha: 'def' } });
      }
      if (urlStr.includes('/pulls') && init?.method === 'POST') {
        const body = JSON.parse(init.body as string) as { body: string };
        prBodies.push(body.body);
        return jsonResponse({ number: 45, html_url: 'https://github.com/...', draft: true });
      }
      return jsonResponse({}, 404);
    });
    vi.stubGlobal('fetch', mockFetch);

    await handleDeploymentStatus(
      makeEvent(),
      makeFindings(1),
      'stub-token',
      makeConfig(),
      new InMemoryRateLedger(),
    );

    expect(prBodies.length).toBeGreaterThan(0);
    const firstBody = prBodies[0] ?? '';
    expect(firstBody).toContain('Triggered by Vercel deployment');
  });

  it('does not open fix-PRs when all findings are in the baseline', async () => {
    vi.stubGlobal('fetch', vi.fn());
    const finding = makeFindings(1)[0]!;
    const config = makeConfig({
      baselineFingerprints: new Set([finding.fingerprint]),
    });

    const result = await handleDeploymentStatus(
      makeEvent(),
      [finding],
      'token',
      config,
      new InMemoryRateLedger(),
    );

    expect(result.openedCount).toBe(0);
  });
});
