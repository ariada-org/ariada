// SPDX-License-Identifier: EUPL-1.2
// Tests for the GitHub check_run.completed handler.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleCheckRunCompleted } from '../src/handler-github.js';
import type { CheckRunCompletedEvent, ReverterGitHubConfig } from '../src/types/github.js';
import type { LocatedFinding } from '../src/cluster.js';
import { InMemoryRateLedger } from '../src/rate-ledger.js';

function makeEvent(overrides: {
  conclusion?: string;
  appSlug?: string;
  installationId?: number;
} = {}): CheckRunCompletedEvent {
  return {
    action: 'completed',
    check_run: {
      id: 1,
      name: 'Accessibility gate',
      conclusion: overrides.conclusion ?? 'failure',
      head_sha: 'abc1234deadbeef',
      app: { slug: overrides.appSlug ?? 'ariada-diff' },
      check_suite: { id: 100 },
      output: { summary: 'Gate failed' },
    },
    repository: {
      full_name: 'fixture-org/fixture-repo',
      owner: { login: 'fixture-org' },
      name: 'fixture-repo',
      default_branch: 'main',
    },
    installation: { id: overrides.installationId ?? 42 },
  };
}

function makeConfig(overrides: Partial<ReverterGitHubConfig> = {}): ReverterGitHubConfig {
  return {
    githubApiBaseUrl: 'http://localhost:9002',
    cascadeBaseUrl: 'http://localhost:9001',
    maxTier: 3,
    maxPrsPerEvent: 5,
    ...overrides,
  };
}

function makeFindings(count: number): LocatedFinding[] {
  return Array.from({ length: count }, (_, i) => ({
    ruleId: 'color-contrast',
    wcagSc: '1.4.3',
    jurisdictionTags: ['WCAG21'],
    severity: 'serious' as const,
    selector: `button:nth-child(${i + 1})`,
    fingerprint: `${'a'.repeat(63)}${i}`,
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

describe('handleCheckRunCompleted — always draft', () => {
  beforeEach(() => { vi.resetAllMocks(); });

  it('opens draft PRs — all GitHub PR payloads have draft: true', async () => {
    const capturedBodies: Array<Record<string, unknown>> = [];
    const mockFetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      const urlStr = String(url);
      // GitHub: get file content (base64 encoded)
      if (urlStr.includes('/contents/')) {
        const content = Buffer.from("color: '#aaa';", 'utf8').toString('base64');
        return jsonResponse({ type: 'file', content: content + '\n', encoding: 'base64' });
      }
      // Cascade endpoint
      if (urlStr.includes('/v1/fix')) {
        return jsonResponse({
          fix_id: 'rvt_fixture_001',
          status: 'ok',
          tier_used: 1,
          diff: "-color: '#aaa';\n+color: '#595959'; /* contrast ratio 7.0:1 */",
          patched_content: "color: '#595959'; /* contrast ratio 7.0:1 */",
          risk_level: 'safe',
          unresolved_todos: [],
        });
      }
      // GitHub: create branch
      if (urlStr.includes('/git/refs')) {
        return jsonResponse({ ref: 'refs/heads/reverter/fix-test', object: { sha: 'abc' } });
      }
      // GitHub: get file for update (existing SHA)
      // GitHub: update/commit file
      if (urlStr.includes('/contents/src') && init?.method === 'PUT') {
        return jsonResponse({ commit: { sha: 'def456' } });
      }
      // GitHub: open PR
      if (urlStr.includes('/pulls') && init?.method === 'POST') {
        const body = JSON.parse(init.body as string) as Record<string, unknown>;
        capturedBodies.push(body);
        return jsonResponse({
          number: 42,
          html_url: 'https://github.com/fixture-org/fixture-repo/pull/42',
          draft: true,
          state: 'open',
        });
      }
      return jsonResponse({}, 404);
    });
    vi.stubGlobal('fetch', mockFetch);

    const ledger = new InMemoryRateLedger();
    const result = await handleCheckRunCompleted(
      makeEvent(),
      makeFindings(1),
      'stub-token-abc',
      7,
      makeConfig(),
      ledger,
    );

    // Verify at least one PR was opened
    expect(result.openedCount).toBeGreaterThan(0);
    // Verify every PR payload had draft: true
    for (const body of capturedBodies) {
      expect(body['draft']).toBe(true);
    }
    // Opened PR has draft: true on the result object
    const firstPr = result.opened[0];
    expect(firstPr?.draft).toBe(true);
  });
});

describe('handleCheckRunCompleted — event filtering', () => {
  beforeEach(() => { vi.resetAllMocks(); });

  it('ignores check runs from apps other than ariada-diff', async () => {
    vi.stubGlobal('fetch', vi.fn());
    const result = await handleCheckRunCompleted(
      makeEvent({ appSlug: 'other-app' }),
      makeFindings(1),
      'token',
      7,
      makeConfig(),
      new InMemoryRateLedger(),
    );
    expect(result.openedCount).toBe(0);
  });

  it('ignores check runs that did not fail (success)', async () => {
    vi.stubGlobal('fetch', vi.fn());
    const result = await handleCheckRunCompleted(
      makeEvent({ conclusion: 'success' }),
      makeFindings(1),
      'token',
      7,
      makeConfig(),
      new InMemoryRateLedger(),
    );
    expect(result.openedCount).toBe(0);
  });

  it('returns zero for empty findings list', async () => {
    vi.stubGlobal('fetch', vi.fn());
    const result = await handleCheckRunCompleted(
      makeEvent(),
      [],
      'token',
      7,
      makeConfig(),
      new InMemoryRateLedger(),
    );
    expect(result.openedCount).toBe(0);
  });
});

describe('handleCheckRunCompleted — rate cap', () => {
  beforeEach(() => { vi.resetAllMocks(); });

  it('posts a rate-limit comment when the 6th PR open is attempted', async () => {
    const commentBodies: string[] = [];
    const mockFetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      const urlStr = String(url);
      if (urlStr.includes('/contents/')) {
        const content = Buffer.from("color: '#aaa';", 'utf8').toString('base64');
        return jsonResponse({ type: 'file', content: content + '\n', encoding: 'base64' });
      }
      if (urlStr.includes('/v1/fix')) {
        return jsonResponse({
          fix_id: 'rvt_ok',
          status: 'ok',
          tier_used: 1,
          diff: "-color: '#aaa';\n+color: '#595959';",
          patched_content: "color: '#595959';",
          risk_level: 'safe',
          unresolved_todos: [],
        });
      }
      if (urlStr.includes('/git/refs')) {
        return jsonResponse({ ref: 'refs/heads/test' });
      }
      if (urlStr.includes('/contents/src') && init?.method === 'PUT') {
        return jsonResponse({ commit: { sha: 'abc' } });
      }
      if (urlStr.includes('/pulls') && init?.method === 'POST') {
        return jsonResponse({ number: 42, html_url: 'https://github.com/fixture-org/fixture-repo/pull/42', draft: true });
      }
      // Rate-limit comment posted on issues endpoint
      if (urlStr.includes('/issues/') && init?.method === 'POST') {
        const body = JSON.parse(init.body as string) as { body: string };
        commentBodies.push(body.body);
        return jsonResponse({ id: 1 });
      }
      return jsonResponse({}, 404);
    });
    vi.stubGlobal('fetch', mockFetch);

    // Seed the ledger with 5 existing PRs (= maxPrsPerEvent)
    const ledger = new InMemoryRateLedger();
    ledger.seedForTest('42', 5);

    const result = await handleCheckRunCompleted(
      makeEvent({ installationId: 42 }),
      makeFindings(1),
      'stub-token',
      7,
      makeConfig({ maxPrsPerEvent: 5 }),
      ledger,
    );

    expect(result.rateLimitCommentPosted).toBe(true);
    expect(commentBodies.length).toBeGreaterThan(0);
    const firstComment = commentBodies[0];
    expect(firstComment).toContain('daily fix-PR limit');
    expect(firstComment).toContain('Upgrade to unlock more');
  });
});

describe('handleCheckRunCompleted — PR body content', () => {
  beforeEach(() => { vi.resetAllMocks(); });

  it('PR body contains fix ID and draft warning', async () => {
    const prBodies: string[] = [];
    const mockFetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      const urlStr = String(url);
      if (urlStr.includes('/contents/')) {
        const content = Buffer.from("color: '#aaa';", 'utf8').toString('base64');
        return jsonResponse({ type: 'file', content: content + '\n', encoding: 'base64' });
      }
      if (urlStr.includes('/v1/fix')) {
        return jsonResponse({
          fix_id: 'rvt_fixture_001',
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
        const body = JSON.parse(init.body as string) as { body: string };
        prBodies.push(body.body);
        return jsonResponse({ number: 42, html_url: 'https://github.com/fixture-org/fixture-repo/pull/42', draft: true });
      }
      return jsonResponse({}, 404);
    });
    vi.stubGlobal('fetch', mockFetch);

    await handleCheckRunCompleted(
      makeEvent(),
      makeFindings(1),
      'stub-token-abc',
      7,
      makeConfig(),
      new InMemoryRateLedger(),
    );

    expect(prBodies.length).toBeGreaterThan(0);
    const body = prBodies[0] ?? '';
    expect(body).toContain('rvt_fixture_001');
    expect(body).toContain('draft PR');
    expect(body).toContain('Reverter does not auto-merge');
  });
});
