# @ariada-org/scan-backend

Runtime-agnostic Hono router factory + schemas + auth + scoring helpers.
Consumed by `services/backend` (Node + Hono on Hetzner per ADR-003) and was
previously consumed by CF Workers (now removed in salvage migration 2026-04-27).

## Salvage migration (v0.2.0, 2026-04-27)

Per ADR-003 (hosting topology) the CF Workers / DO / D1 / R2 / KV / Queue
runtime is gone. This package no longer imports `@cloudflare/workers-types`.
Routes accept an injected `ScanBackendDeps` bag (drizzle DB, Redis, NATS,
BlobStore) instead of CF bindings.

## Origin

Written here rather than adapted from anything: the router, the request and
response schemas, and the scoring helpers the scanner packages share.

## Usage (Node host)

```ts
import { createScanRouter } from '@ariada-org/scan-backend';
const app = createScanRouter({
  brand: 'ariada',
  scorecardDepth: 'full',
  baseUrl: 'https://ariada.org',
  siblingBaseUrls: { dracula: 'https://draculascan.org' },
});
// mount under your Node Hono server, providing deps via app.use middleware
```

`ScanBackendDeps` shape:

| Variable | Type                                  | Notes                                  |
|----------|---------------------------------------|----------------------------------------|
| db       | DrizzleLike (pg)                      | Postgres via drizzle-orm + postgres-js |
| redis    | RedisLike (ioredis or compatible)     | sliding-window rate limit, badge cache |
| nats     | NatsLike                              | publish `scan.request`                 |
| blobs    | BlobStore                             | screenshots, OG images                 |

## Tests

`pnpm vitest run` — auth, rate-limit, attribution, schemas. Routes test mocks
deps in-memory.

## Update

- Author: Alekszandr Bricskin (Agonist Development AB) — original CF-Workers form
- Date: 2026-04-19
- Author: Alekszandr Bricskin (Agonist Development AB) — runtime-agnostic port
- Date: 2026-04-27
