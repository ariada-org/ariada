/**
 * Runtime-agnostic dependency interfaces injected into the router via Hono
 * Variables (`c.var.deps`). The Node host (services/backend) wires these
 * to drizzle/postgres-js, ioredis, nats-js, and a filesystem BlobStore.
 *
 * Replaces the prior CF-Workers Bindings (D1, KV, R2, Queue, DurableObject).
 *
 * @patentBinding('J','IC1')
 */
import type { ScanEvent } from '@ariada-org/core';

import type { ScanRequestMessage } from './schemas.js';

/** Minimal SQL row record. */
export type Row = Record<string, unknown>;

/**
 * Database abstraction — small surface used by router routes.
 *
 * The Node implementation wraps drizzle + postgres-js; tests use an in-memory
 * map. Statements use `$1, $2, ...` Postgres-style placeholders. The legacy
 * SQLite `?` placeholders from D1 days are normalized in the host to `$N`.
 */
export interface DbLike {
  /** Execute INSERT/UPDATE/DELETE; resolves to row count. */
  execute(sql: string, params: unknown[]): Promise<{ rowCount: number }>;
  /** Execute SELECT; returns first row or null. */
  queryOne<T extends Row = Row>(sql: string, params: unknown[]): Promise<T | null>;
  /** Execute SELECT; returns all rows. */
  queryMany<T extends Row = Row>(sql: string, params: unknown[]): Promise<T[]>;
}

/**
 * Redis-style key-value store. Compatible with `ioredis` minimal API and the
 * legacy CF KV-shaped `KVNamespaceLike` (kept exported for backwards-compat in
 * unit tests).
 */
export interface RedisLike {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, opts?: { exSec?: number }): Promise<void>;
  /** Optional convenience used by per-key TTL caches. */
  expire?(key: string, sec: number): Promise<void>;
}

/** NATS publish-only surface (subscribe is host-side, not router-side). */
export interface NatsLike {
  publish(subject: string, payload: ScanRequestMessage | Uint8Array | string): Promise<void>;
}

/** Blob storage abstraction (filesystem or S3-compatible). */
export interface BlobStore {
  put(key: string, data: Uint8Array | string, opts?: { contentType?: string }): Promise<void>;
  get(key: string): Promise<Uint8Array | null>;
  delete(key: string): Promise<void>;
}

/**
 * The full deps bag flowing through the router. Hosts construct this once and
 * inject via `app.use(async (c, next) => { c.set('deps', deps); await next(); })`.
 */
export interface ScanBackendDeps {
  db: DbLike;
  redis: RedisLike;
  nats: NatsLike;
  blobs: BlobStore;
  /** Server config (secrets, brand, base URLs). */
  config: ScanBackendRuntimeConfig;
  /** Optional: live SSE event publisher used by /api/scan/:id/event when
   *  wiring directly bypasses NATS (e.g. in tests). */
  publishEvent?(scanId: string, event: ScanEvent): void;
}

/** Per-instance runtime configuration. */
export interface ScanBackendRuntimeConfig {
  brand: 'ariada' | 'dracula';
  scorecardDepth: 'top-5' | 'full';
  baseUrl: string;
  siblingBaseUrls: Record<string, string>;
  turnstileSecretKey: string;
  vpsSharedSecret: string;
  dailyIpSaltSecret: string;
  natsScanRequestSubject: string;
}
