/**
 * @ariada-org/scan-backend — runtime-agnostic Hono router + helpers (v0.2.0).
 *
 * Salvage migration 2026-04-27: dropped CF Workers / DO / D1 / KV / Queue.
 * Hosts (services/backend) inject {db, redis, nats, blobs, config} via Hono
 * Variables (`c.var.deps`).
 *
 * Written here rather than adapted: the router, the schemas and the scoring
 * @patentBinding('J','IC1')
 * @patentBinding('K','IC1')
 *
 * License: Apache-2.0
 */
export { createScanRouter } from './router.js';
export type {
  ScanBackendConfig,
  ScanBackendVars,
} from './router.js';
export type {
  DbLike,
  RedisLike,
  NatsLike,
  BlobStore,
  Row,
  ScanBackendDeps,
  ScanBackendRuntimeConfig,
} from './deps.js';
export { signBody, verifySignature, hashIp } from './auth.js';
export { checkScanRateLimit, DEFAULT_LIMITS, redisAsKv } from './rate-limit.js';
export type { RateLimitConfig, RateLimitDecision, KVNamespaceLike } from './rate-limit.js';
export { isScanAllowed } from './robots-check.js';
export {
  parseUtmFromUrl,
  readAriadaSrcCookie,
  makeSetCookie,
  recordEvent,
} from './attribution.js';
export {
  scanRequestMessageSchema,
  scanInitiateSchema,
  scanCallbackBodySchema,
  eventIngestSchema,
  brandSchema,
} from './schemas.js';
export type {
  ScanRequestMessage,
  ScanInitiate,
  ScanCallbackBody,
  EventIngest,
  Brand,
} from './schemas.js';
export { OgTemplate } from './og-template.js';
export type { OgProps } from './og-template.js';
export { scoreFromCounts, bandFromScore } from './scoring.js';
export type { Counts, ScoreBand } from './scoring.js';
