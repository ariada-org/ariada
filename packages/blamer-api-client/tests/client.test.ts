// SPDX-License-Identifier: EUPL-1.2
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BlamedApiClient, createBlamedClient } from '../src/client.js';
import type { AttributionInput } from '@ariada-org/ai-authorship';

/** Minimal fixture posterior matching the real AttributionPosterior contract. Sorted descending. */
function makePosterior(topAgent = 'copilot', probability = 0.82) {
  const entries = [
    { agent: topAgent, probability },
    { agent: 'human', probability: 1 - probability },
  ].sort((a, b) => b.probability - a.probability);
  return {
    posterior: entries,
    confidence: probability,
    signal_contributions: [],
    classifier_version: 'test-1.0',
    calibration_version: '1.0',
    inferred_at_utc: new Date().toISOString(),
    inference_mode: 'hosted' as const,
  };
}

/** Minimal fixture input matching AttributionInput contract */
function makeInput(code = 'const x = 1;'): AttributionInput {
  return {
    diffHunk: code,
    language: 'typescript',
    filePath: 'src/index.ts',
    commitMetadata: { authorEmail: 'abc123', timestamp: '2026-01-01T00:00:00Z' },
  };
}

function makeClient(overrides?: Record<string, string>) {
  return new BlamedApiClient({
    baseUrl: 'http://localhost:3099',
    bearerToken: 'test-token',
    ...overrides,
  });
}

describe('BlamedApiClient.attributeBatch', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns ok=true with posteriors on HTTP 200', async () => {
    const posterior = makePosterior();
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ results: [posterior], request_id: 'req_001' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', mockFetch);

    const client = makeClient();
    const result = await client.attributeBatch([makeInput()]);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(1);
      expect(result.value[0]!.posterior[0]!.agent).toBe('copilot');
    }
  });

  it('returns ok=false with auth_failed on HTTP 401', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response('{"error":"unauthorized"}', { status: 401 }),
    );
    vi.stubGlobal('fetch', mockFetch);

    const client = makeClient();
    const result = await client.attributeBatch([makeInput()]);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('auth_failed');
      expect(result.error.message).toContain('Authentication failed');
    }
  });

  it('returns ok=false with quota_exceeded on HTTP 402', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: 'quota_exceeded',
          reset_at: '2026-07-01T00:00:00Z',
          upgrade_url: 'https://example.com/upgrade',
        }),
        { status: 402, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', mockFetch);

    const client = makeClient();
    const result = await client.attributeBatch([makeInput()]);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('quota_exceeded');
      expect(result.error.resetAt).toBe('2026-07-01T00:00:00Z');
      expect(result.error.upgradeUrl).toBe('https://example.com/upgrade');
    }
  });

  it('returns ok=false with server_error on HTTP 500', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response('Internal Server Error', { status: 500 }),
    );
    vi.stubGlobal('fetch', mockFetch);

    const client = makeClient();
    const result = await client.attributeBatch([makeInput()]);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('server_error');
      expect(result.error.statusCode).toBe(500);
    }
  });

  it('returns ok=false with network_error on fetch throw', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    vi.stubGlobal('fetch', mockFetch);

    const client = makeClient();
    const result = await client.attributeBatch([makeInput()]);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('network_error');
    }
  });

  it('sends correct Authorization header', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ results: [], request_id: 'r' }), { status: 200 }),
    );
    vi.stubGlobal('fetch', mockFetch);

    const client = makeClient({ bearerToken: 'my-secret-token' });
    await client.attributeBatch([makeInput()]);

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer my-secret-token');
  });

  it('includes GitHub installation header when provided', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ results: [], request_id: 'r' }), { status: 200 }),
    );
    vi.stubGlobal('fetch', mockFetch);

    const client = new BlamedApiClient({
      baseUrl: 'http://localhost:3099',
      bearerToken: 'tok',
      githubInstallationId: 'install-42',
    });
    await client.attributeBatch([makeInput()]);

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)['X-GitHub-Installation-Id']).toBe('install-42');
  });
});

describe('BlamedApiClient.getReport', () => {
  it('builds a BlamedReport from posteriors', async () => {
    const posterior = makePosterior('copilot', 0.73);
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ results: [posterior, posterior], request_id: 'req_002' }),
        { status: 200 },
      ),
    );
    vi.stubGlobal('fetch', mockFetch);

    const client = makeClient();
    const result = await client.getReport('42', 'pull_request', 'owner/repo', [makeInput(), makeInput()]);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.subjectId).toBe('42');
      expect(result.value.subjectType).toBe('pull_request');
      expect(result.value.repo).toBe('owner/repo');
      expect(result.value.diffMix.length).toBeGreaterThan(0);
      expect(result.value.violations).toEqual([]);
      expect(typeof result.value.generatedAt).toBe('string');
    }
  });

  it('sets thresholdViolated when AI fraction exceeds threshold', async () => {
    // copilot at 90% for two hunks — well above default 60% threshold
    const posterior = makePosterior('copilot', 0.9);
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ results: [posterior], request_id: 'r' }), { status: 200 }),
    );
    vi.stubGlobal('fetch', mockFetch);

    const client = makeClient();
    const result = await client.getReport('1', 'pull_request', 'a/b', [makeInput()], {
      thresholdFraction: 0.6,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.thresholdViolated).toBe(true);
      expect(result.value.triggeringFraction).toBeGreaterThan(0.6);
    }
  });

  it('propagates API errors from attributeBatch', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response('', { status: 401 }),
    );
    vi.stubGlobal('fetch', mockFetch);

    const client = makeClient();
    const result = await client.getReport('1', 'pull_request', 'a/b', [makeInput()]);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('auth_failed');
    }
  });
});

describe('createBlamedClient', () => {
  it('creates a client with defaults from environment', () => {
    const client = createBlamedClient({ baseUrl: 'http://localhost:3099', bearerToken: 'tok' });
    expect(client).toBeInstanceOf(BlamedApiClient);
  });
});
