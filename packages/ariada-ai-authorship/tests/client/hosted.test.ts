// SPDX-License-Identifier: EUPL-1.2
//
// Hosted-mode client tests — exercise the wire contract documented in the
// package wire spec. Uses an injected `fetch` mock so no real network calls
// happen.

import { describe, it, expect } from 'vitest';

import { hostedAttributeBatch } from '../../src/client/http.js';
import {
  ALL_AGENTS,
  type AttributionPosterior,
} from '../../src/types.js';
import { sampleInput } from '../helpers.js';

function mockPosterior(): AttributionPosterior {
  const probs = ALL_AGENTS.map((a, i) => ({
    agent: a,
    probability: (ALL_AGENTS.length - i) / 55,
  }));
  // Normalise so the array sums to 1.
  const sum = probs.reduce((s, e) => s + e.probability, 0);
  const norm = probs.map((e) => ({ ...e, probability: e.probability / sum }));
  return {
    posterior: norm,
    confidence: 0.7,
    signal_contributions: [],
    classifier_version: '1.0.0',
    calibration_version: '1.0.0',
    inferred_at_utc: '2026-05-20T12:00:00.000Z',
    inference_mode: 'hosted',
  };
}

describe('hosted-mode wire contract', () => {
  it('returns posteriors on a 200 response', async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response(
        JSON.stringify({
          results: [mockPosterior()],
          classifier_version: '1.0.0',
          calibration_version: '1.0.0',
          request_id: 'req-abc',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    const r = await hostedAttributeBatch([sampleInput()], {
      endpoint: 'https://api.example/v1/attribute',
      api_key: 'test-key',
      client_version: '0.1.0',
      fetch_impl: fetchImpl,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toHaveLength(1);
  });

  it('returns hosted_rate_limited on HTTP 429', async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response('', {
        status: 429,
        headers: { 'Retry-After': '42' },
      });
    const r = await hostedAttributeBatch([sampleInput()], {
      endpoint: 'https://api.example/v1/attribute',
      api_key: 'test-key',
      client_version: '0.1.0',
      fetch_impl: fetchImpl,
    });
    expect(r.ok).toBe(false);
    if (!r.ok && r.error.kind === 'hosted_rate_limited') {
      expect(r.error.retry_after_seconds).toBe(42);
    } else {
      expect.fail('expected hosted_rate_limited');
    }
  });

  it('returns classifier_version_mismatch on HTTP 410', async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response('', { status: 410 });
    const r = await hostedAttributeBatch([sampleInput()], {
      endpoint: 'https://api.example/v1/attribute',
      api_key: 'test-key',
      client_version: '0.0.1',
      fetch_impl: fetchImpl,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.kind).toBe('classifier_version_mismatch');
    }
  });

  it('returns hosted_unreachable on network failure', async () => {
    const fetchImpl: typeof fetch = async () => {
      throw new Error('connect ECONNREFUSED');
    };
    const r = await hostedAttributeBatch([sampleInput()], {
      endpoint: 'https://api.example/v1/attribute',
      api_key: 'test-key',
      client_version: '0.1.0',
      fetch_impl: fetchImpl,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe('hosted_unreachable');
  });

  it('rejects batch sizes above 256', async () => {
    const inputs = Array.from({ length: 257 }).map(() => sampleInput());
    const r = await hostedAttributeBatch(inputs, {
      endpoint: 'https://api.example/v1/attribute',
      api_key: 'test-key',
      client_version: '0.1.0',
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe('input_invalid');
  });
});
