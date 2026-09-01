import { describe, it, expect } from 'vitest';

import { checkScanRateLimit, redisAsKv, type KVNamespaceLike } from '../src/rate-limit.js';

function memoryKv(): KVNamespaceLike {
  const store = new Map<string, string>();
  return {
    async get(k) {
      return store.get(k) ?? null;
    },
    async put(k, v) {
      store.set(k, v);
    },
  };
}

describe('checkScanRateLimit (KV-shape)', () => {
  it('first call passes', async () => {
    const kv = memoryKv();
    const r = await checkScanRateLimit(kv, 'iphash1', 'example.com');
    expect(r.ok).toBe(true);
  });

  it('second call within 30s burst window blocks (default burst=1)', async () => {
    const kv = memoryKv();
    const t = 1_700_000_000_000;
    const r1 = await checkScanRateLimit(kv, 'iphash1', 'example.com', undefined, t);
    expect(r1.ok).toBe(true);
    const r2 = await checkScanRateLimit(kv, 'iphash1', 'example.com', undefined, t + 1000);
    expect(r2.ok).toBe(false);
    expect(r2.reason).toBe('burst');
  });

  it('different ip not affected', async () => {
    const kv = memoryKv();
    const t = 1_700_000_000_000;
    await checkScanRateLimit(kv, 'a', 'example.com', undefined, t);
    const r = await checkScanRateLimit(kv, 'b', 'example.com', undefined, t);
    expect(r.ok).toBe(true);
  });

  it('per-target cap blocks same target hit twice within 5min from same IP', async () => {
    const kv = memoryKv();
    let t = 1_700_000_000_000;
    const r1 = await checkScanRateLimit(kv, 'a', 'host.com', undefined, t);
    expect(r1.ok).toBe(true);
    t += 31_000; // past burst
    const r2 = await checkScanRateLimit(kv, 'a', 'host.com', undefined, t);
    expect(r2.ok).toBe(false);
    expect(r2.reason).toBe('target');
  });
});

describe('redisAsKv adapter', () => {
  it('forwards get/set with TTL conversion', async () => {
    const calls: Array<{ op: string; key: string; value?: string; exSec?: number }> = [];
    const redis = {
      async get(k: string) {
        calls.push({ op: 'get', key: k });
        return null;
      },
      async set(k: string, v: string, opts?: { exSec?: number }) {
        const c: { op: string; key: string; value: string; exSec?: number } = {
          op: 'set',
          key: k,
          value: v,
        };
        if (opts?.exSec !== undefined) c.exSec = opts.exSec;
        calls.push(c);
      },
    };
    const kv = redisAsKv(redis);
    await kv.put('k', 'v', { expirationTtl: 60 });
    expect(calls[0]).toEqual({ op: 'set', key: 'k', value: 'v', exSec: 60 });
  });
});
