/**
 * Sliding-window rate limiter — Redis-backed via RedisLike.
 * Buckets: 30s / 1h / 24h per IP-hash + per target-host per IP.
 * @patentBinding('J','IC1')
 *
 * Salvage migration: previously KV-backed under CF Workers; the surface is
 * unchanged (consumers pass any object honoring `KVNamespaceLike`), but the
 * Node host wires this to ioredis via a thin adapter.
 */

/**
 *
 */
export interface RateLimitConfig {
  perIp: { burst: number; hour: number; day: number };
  perTargetPerIp: { fiveMin: number };
}

export const DEFAULT_LIMITS: RateLimitConfig = {
  perIp: { burst: 1, hour: 5, day: 20 },
  perTargetPerIp: { fiveMin: 1 },
};

/**
 * Minimal interface honored by both the legacy KV adapter and ioredis adapter.
 * Kept exported for backward-compat with existing tests.
 */
export interface KVNamespaceLike {
  get(key: string, opts?: { type?: 'text' | 'json' }): Promise<string | null>;
  put(
    key: string,
    value: string,
    opts?: { expirationTtl?: number },
  ): Promise<void>;
}

interface Bucket {
  count: number;
  resetAt: number;
}

async function consume(
  kv: KVNamespaceLike,
  key: string,
  limit: number,
  windowSec: number,
  now: number,
): Promise<{ ok: boolean; remaining: number; resetAt: number }> {
  const raw = await kv.get(key);
  let bucket: Bucket = raw
    ? (JSON.parse(raw) as Bucket)
    : { count: 0, resetAt: now + windowSec * 1000 };
  if (bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + windowSec * 1000 };
  }
  if (bucket.count >= limit) {
    return { ok: false, remaining: 0, resetAt: bucket.resetAt };
  }
  bucket.count++;
  await kv.put(key, JSON.stringify(bucket), { expirationTtl: windowSec + 5 });
  return { ok: true, remaining: limit - bucket.count, resetAt: bucket.resetAt };
}

/**
 *
 */
export interface RateLimitDecision {
  ok: boolean;
  reason?: 'burst' | 'hour' | 'day' | 'target';
  retryAfterSec?: number;
}

/**
 *
 */
export async function checkScanRateLimit(
  kv: KVNamespaceLike,
  ipHash: string,
  targetHost: string,
  cfg: RateLimitConfig = DEFAULT_LIMITS,
  now: number = Date.now(),
): Promise<RateLimitDecision> {
  const burst = await consume(kv, `rl:burst:${ipHash}`, cfg.perIp.burst, 30, now);
  if (!burst.ok) {
    return { ok: false, reason: 'burst', retryAfterSec: Math.ceil((burst.resetAt - now) / 1000) };
  }
  const hour = await consume(kv, `rl:hour:${ipHash}`, cfg.perIp.hour, 3600, now);
  if (!hour.ok) {
    return { ok: false, reason: 'hour', retryAfterSec: Math.ceil((hour.resetAt - now) / 1000) };
  }
  const day = await consume(kv, `rl:day:${ipHash}`, cfg.perIp.day, 86400, now);
  if (!day.ok) {
    return { ok: false, reason: 'day', retryAfterSec: Math.ceil((day.resetAt - now) / 1000) };
  }
  const tgt = await consume(
    kv,
    `rl:tgt:${ipHash}:${targetHost}`,
    cfg.perTargetPerIp.fiveMin,
    300,
    now,
  );
  if (!tgt.ok) {
    return { ok: false, reason: 'target', retryAfterSec: Math.ceil((tgt.resetAt - now) / 1000) };
  }
  return { ok: true };
}

/** Bridge a `RedisLike` (services/backend Node host) to the local KV-shaped surface. */
export function redisAsKv(redis: {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, opts?: { exSec?: number }): Promise<void>;
}): KVNamespaceLike {
  return {
    async get(key) {
      return redis.get(key);
    },
    async put(key, value, opts) {
      if (opts?.expirationTtl !== undefined) {
        await redis.set(key, value, { exSec: opts.expirationTtl });
      } else {
        await redis.set(key, value);
      }
    },
  };
}
