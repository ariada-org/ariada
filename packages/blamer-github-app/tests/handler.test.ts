// SPDX-License-Identifier: EUPL-1.2
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handlePullRequest, handleInstallation } from '../src/handler.js';
import type { GitHubAppConfig, PullRequestEvent, InstallationEvent } from '../src/types.js';

/** Default fixture config — all HTTP calls go to localhost:3099 */
function makeConfig(overrides: Partial<GitHubAppConfig> = {}): GitHubAppConfig {
  return {
    blamedApiBaseUrl: 'http://localhost:3099',
    blamedApiToken: 'test-blamer-token',
    githubApiBaseUrl: 'http://localhost:3099',
    installationToken: 'test-installation-token',
    webhookSecret: 'test-webhook-secret',
    thresholdFraction: 0.6,
    enableThresholdBlock: false,
    ...overrides,
  };
}

/** Fixture pull_request event */
function makePREvent(overrides: Partial<PullRequestEvent['pull_request']> = {}): PullRequestEvent {
  return {
    action: 'opened',
    installation: { id: 42 },
    repository: {
      full_name: 'fixture/repo',
      owner: { login: 'fixture' },
      name: 'repo',
    },
    pull_request: {
      number: 7,
      head: { sha: 'abc123def456' },
      ...overrides,
    },
  };
}

/** Create a mock Response */
function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Minimal AttributionPosterior matching the real contract.
 * The posterior array is sorted descending by probability (invariant 3).
 */
function makePosterior(topAgent = 'copilot', probability = 0.73) {
  const entries = [
    { agent: topAgent, probability },
    { agent: 'human', probability: 1 - probability },
  ].sort((a, b) => b.probability - a.probability);
  return {
    posterior: entries,
    confidence: probability,
    signal_contributions: [],
    classifier_version: '1.0',
    calibration_version: '1.0',
    inferred_at_utc: new Date().toISOString(),
    inference_mode: 'hosted',
  };
}

describe('handlePullRequest — happy path (pass conclusion)', () => {
  beforeEach(() => { vi.resetAllMocks(); });

  it('creates a check run, calls Blamer API, updates check run, posts comment', async () => {
    const calls: Array<[string, RequestInit | undefined]> = [];
    const mockFetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      calls.push([url, init]);
      const urlStr = String(url);

      // GitHub: create check run
      if (urlStr.includes('/check-runs') && init?.method === 'POST') {
        return jsonResponse({ id: 1, html_url: 'https://github.com/fixture/repo/runs/1' });
      }
      // GitHub: fetch PR files
      if (urlStr.includes('/pulls/7/files')) {
        return jsonResponse([
          { filename: 'src/App.tsx', patch: '+const x = 1;', additions: 1, deletions: 0 },
        ]);
      }
      // Blamer API
      if (urlStr.includes('/v1/attribute')) {
        return jsonResponse({ results: [makePosterior('copilot', 0.45)], request_id: 'r1' });
      }
      // GitHub: update check run (PATCH)
      if (urlStr.includes('/check-runs/1') && init?.method === 'PATCH') {
        return jsonResponse({ id: 1 });
      }
      // GitHub: post PR comment
      if (urlStr.includes('/issues/7/comments') && init?.method === 'POST') {
        return jsonResponse({ id: 100, html_url: 'https://github.com/...' });
      }
      return jsonResponse({}, 404);
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await handlePullRequest(makePREvent(), makeConfig());

    expect(result.checkRunId).toBe(1);
    expect(result.conclusion).toBe('success');
    expect(result.commentId).toBe(100);
    expect(result.quotaExceeded).toBe(false);
    expect(result.authFailed).toBe(false);
    // Comment must contain attribution table
    expect(result.commentBody).toContain('Agent');
    // Report body contains attribution table header; no commercial domain required
    expect(result.commentBody).toContain('Lines');
  });
});

describe('handlePullRequest — fail conclusion (threshold exceeded)', () => {
  beforeEach(() => { vi.resetAllMocks(); });

  it('sets conclusion=failure and comment contains threshold note', async () => {
    const mockFetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      const urlStr = String(url);
      if (urlStr.includes('/check-runs') && init?.method === 'POST') {
        return jsonResponse({ id: 2, html_url: 'https://github.com/fixture/repo/runs/2' });
      }
      if (urlStr.includes('/pulls/7/files')) {
        return jsonResponse([
          { filename: 'src/Button.tsx', patch: '+const btn = <button/>;', additions: 1, deletions: 0 },
        ]);
      }
      if (urlStr.includes('/v1/attribute')) {
        // 80% copilot — exceeds 60% threshold
        return jsonResponse({ results: [makePosterior('copilot', 0.8)], request_id: 'r2' });
      }
      if (urlStr.includes('/check-runs/2') && init?.method === 'PATCH') {
        return jsonResponse({ id: 2 });
      }
      if (urlStr.includes('/issues/7/comments') && init?.method === 'POST') {
        return jsonResponse({ id: 101, html_url: 'https://github.com/...' });
      }
      return jsonResponse({}, 404);
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await handlePullRequest(makePREvent(), makeConfig({ thresholdFraction: 0.6 }));

    expect(result.conclusion).toBe('failure');
    expect(result.commentBody).toContain('exceeds threshold');
  });
});

describe('handlePullRequest — quota exceeded (402)', () => {
  beforeEach(() => { vi.resetAllMocks(); });

  it('posts degraded-mode comment with reset date, no attribution table', async () => {
    const mockFetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      const urlStr = String(url);
      if (urlStr.includes('/check-runs') && init?.method === 'POST') {
        return jsonResponse({ id: 3, html_url: '' });
      }
      if (urlStr.includes('/pulls/7/files')) {
        return jsonResponse([{ filename: 'a.ts', patch: '+x', additions: 1, deletions: 0 }]);
      }
      if (urlStr.includes('/v1/attribute')) {
        return jsonResponse(
          { error: 'quota_exceeded', reset_at: '2026-07-01T00:00:00Z', upgrade_url: 'https://example.com/upgrade' },
          402,
        );
      }
      if (urlStr.includes('/check-runs/3') && init?.method === 'PATCH') {
        return jsonResponse({ id: 3 });
      }
      if (urlStr.includes('/issues/7/comments') && init?.method === 'POST') {
        return jsonResponse({ id: 102, html_url: '' });
      }
      return jsonResponse({}, 404);
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await handlePullRequest(makePREvent(), makeConfig());

    expect(result.quotaExceeded).toBe(true);
    expect(result.commentBody).toContain('free-tier quota');
    expect(result.commentBody).not.toContain('| Agent |');
  });
});

describe('handlePullRequest — auth error (401)', () => {
  beforeEach(() => { vi.resetAllMocks(); });

  it('posts auth-error comment with no attribution data', async () => {
    const mockFetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      const urlStr = String(url);
      if (urlStr.includes('/check-runs') && init?.method === 'POST') {
        return jsonResponse({ id: 4, html_url: '' });
      }
      if (urlStr.includes('/pulls/7/files')) {
        return jsonResponse([{ filename: 'a.ts', patch: '+x', additions: 1, deletions: 0 }]);
      }
      if (urlStr.includes('/v1/attribute')) {
        return jsonResponse({ error: 'unauthorized' }, 401);
      }
      if (urlStr.includes('/check-runs/4') && init?.method === 'PATCH') {
        return jsonResponse({ id: 4 });
      }
      if (urlStr.includes('/issues/7/comments') && init?.method === 'POST') {
        return jsonResponse({ id: 103, html_url: '' });
      }
      return jsonResponse({}, 404);
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await handlePullRequest(makePREvent(), makeConfig());

    expect(result.authFailed).toBe(true);
    expect(result.commentBody).toContain('authentication failed');
    expect(result.commentBody).toContain('reinstall the GitHub App');
    // No attribution data in body
    expect(result.commentBody).not.toContain('| Agent |');
  });
});

describe('handleInstallation', () => {
  it('returns installation metadata with free tier', () => {
    const event: InstallationEvent = {
      action: 'created',
      installation: {
        id: 999,
        account: { login: 'acme-corp', type: 'Organization' },
      },
    };
    const result = handleInstallation(event);
    expect(result.installationId).toBe(999);
    expect(result.orgLogin).toBe('acme-corp');
    expect(result.tier).toBe('free');
  });
});
