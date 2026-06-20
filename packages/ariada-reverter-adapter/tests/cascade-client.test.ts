// SPDX-License-Identifier: EUPL-1.2
// Tests for the cascade API client.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CascadeClient, inferCascadeLanguage } from '../src/cascade-client.js';
import type { FindingCluster } from '../src/types/cascade.js';

function makeCluster(overrides: Partial<FindingCluster> = {}): FindingCluster {
  return {
    ruleId: 'color-contrast',
    wcagSc: '1.4.3',
    sourceFilePath: 'src/Button.tsx',
    fingerprintHashes: ['a'.repeat(64)],
    startLine: 14,
    endLine: 16,
    severity: 'serious',
    ...overrides,
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('CascadeClient.requestFix', () => {
  beforeEach(() => { vi.resetAllMocks(); });

  it('returns ok outcome with diff on success', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce(
      jsonResponse({
        fix_id: 'rvt_fixture_001',
        status: 'ok',
        tier_used: 1,
        diff: "-color: '#aaa';\n+color: '#595959'; /* contrast ratio 7.0:1 */",
        patched_content: "color: '#595959'; /* contrast ratio 7.0:1 */",
        risk_level: 'safe',
        unresolved_todos: [],
      }),
    );
    vi.stubGlobal('fetch', mockFetch);

    const client = new CascadeClient({
      baseUrl: 'http://localhost:9001',
      bearerToken: 'test-token',
      maxTier: 3,
    });

    const outcome = await client.requestFix(makeCluster(), 'color: \'#aaa\';', 'tsx');
    expect(outcome.status).toBe('ok');
    expect(outcome.fixId).toBe('rvt_fixture_001');
    expect(outcome.tierUsed).toBe(1);
    expect(outcome.diff).toContain('#595959');
    expect(outcome.riskLevel).toBe('safe');
    expect(outcome.upgradeCta).toBeUndefined();
  });

  it('returns rate_limited outcome with upgrade CTA', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce(
      jsonResponse({
        fix_id: '',
        status: 'rate_limited',
        tier_used: 0,
        diff: null,
        patched_content: null,
        risk_level: 'needs-review',
        unresolved_todos: [],
        upgrade_cta: 'https://example.com/pricing?ref=rate_limit',
      }),
    );
    vi.stubGlobal('fetch', mockFetch);

    const client = new CascadeClient({
      baseUrl: 'http://localhost:9001',
      bearerToken: 'test-token',
      maxTier: 3,
    });

    const outcome = await client.requestFix(makeCluster(), '', 'tsx');
    expect(outcome.status).toBe('rate_limited');
    expect(outcome.upgradeCta).toBe('https://example.com/pricing?ref=rate_limit');
  });

  it('returns error outcome on non-2xx HTTP response', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce(
      new Response('Internal Server Error', { status: 500 }),
    );
    vi.stubGlobal('fetch', mockFetch);

    const client = new CascadeClient({
      baseUrl: 'http://localhost:9001',
      bearerToken: 'test-token',
      maxTier: 3,
    });

    const outcome = await client.requestFix(makeCluster(), '', 'tsx');
    expect(outcome.status).toBe('error');
    expect(outcome.fixId).toBeNull();
  });

  it('sends max_tier from config in the request body', async () => {
    let capturedBody: Record<string, unknown> | undefined;
    const mockFetch = vi.fn().mockImplementation(async (_url: string, init?: RequestInit) => {
      capturedBody = JSON.parse(init?.body as string) as Record<string, unknown>;
      return jsonResponse({
        fix_id: 'f1', status: 'ok', tier_used: 2, diff: null, patched_content: null,
        risk_level: 'safe', unresolved_todos: [],
      });
    });
    vi.stubGlobal('fetch', mockFetch);

    const client = new CascadeClient({
      baseUrl: 'http://localhost:9001',
      bearerToken: 'token',
      maxTier: 2,
    });
    await client.requestFix(makeCluster(), 'content', 'tsx');

    expect(capturedBody).toBeDefined();
    const opts = capturedBody?.['options'] as Record<string, unknown> | undefined;
    expect(opts?.['max_tier']).toBe(2);
  });

  it('always-draft: verifies the client POSTs to /v1/fix', async () => {
    let capturedUrl = '';
    const mockFetch = vi.fn().mockImplementation(async (url: string) => {
      capturedUrl = url;
      return jsonResponse({
        fix_id: 'f1', status: 'ok', tier_used: 1, diff: '+x', patched_content: 'x',
        risk_level: 'safe', unresolved_todos: [],
      });
    });
    vi.stubGlobal('fetch', mockFetch);

    const client = new CascadeClient({
      baseUrl: 'http://localhost:9001',
      bearerToken: 'token',
      maxTier: 1,
    });
    await client.requestFix(makeCluster(), 'content', 'tsx');

    expect(capturedUrl).toBe('http://localhost:9001/v1/fix');
  });
});

describe('inferCascadeLanguage', () => {
  it('returns tsx for .tsx files', () => {
    expect(inferCascadeLanguage('src/Button.tsx')).toBe('tsx');
  });
  it('returns ts for .ts files', () => {
    expect(inferCascadeLanguage('src/utils.ts')).toBe('ts');
  });
  it('returns css for .css files', () => {
    expect(inferCascadeLanguage('styles/main.css')).toBe('css');
  });
  it('returns html for unknown extensions', () => {
    expect(inferCascadeLanguage('src/component.unknown')).toBe('html');
  });
  it('returns astro for .astro files', () => {
    expect(inferCascadeLanguage('pages/index.astro')).toBe('astro');
  });
});
