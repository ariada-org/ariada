/**
 * Router tests against the v0.2.0 runtime-agnostic surface.
 * Replaces the previous CF-bindings-shaped buildEnv with a ScanBackendDeps
 * fixture wired to in-memory db / redis / nats stubs.
 */
import { Hono } from 'hono';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { signBody } from '../src/auth.js';
import type { ScanBackendDeps, DbLike, RedisLike, NatsLike, BlobStore } from '../src/deps.js';
import { createScanRouter } from '../src/router.js';
import type { ScanRequestMessage } from '../src/schemas.js';

function memoryDb(): DbLike & { _executes: Array<{ sql: string; params: unknown[] }>; _scans: Map<string, Record<string, unknown>> } {
  const executes: Array<{ sql: string; params: unknown[] }> = [];
  const scans = new Map<string, Record<string, unknown>>();
  return {
    _executes: executes,
    _scans: scans,
    async execute(sql, params) {
      executes.push({ sql, params });
      if (sql.startsWith('INSERT INTO scans')) {
        scans.set(`scan:${String(params[0])}`, {
          id: params[0],
          url: params[1],
          url_host: params[2],
          requested_at: params[3],
          status: 'queued',
          ip_hash: params[4],
        });
      }
      return { rowCount: 1 };
    },
    async queryOne(sql, params) {
      if (sql.startsWith('SELECT url FROM scans')) {
        return (scans.get(`scan:${String(params[0])}`) ?? null) as never;
      }
      return null;
    },
    async queryMany() {
      return [];
    },
  };
}

function memoryRedis(): RedisLike & { _store: Map<string, string> } {
  const store = new Map<string, string>();
  return {
    _store: store,
    async get(k) {
      return store.get(k) ?? null;
    },
    async set(k, v) {
      store.set(k, v);
    },
  };
}

function memoryNats(): NatsLike & { _sent: ScanRequestMessage[] } {
  const sent: ScanRequestMessage[] = [];
  return {
    _sent: sent,
    async publish(_subject, payload) {
      if (typeof payload === 'object' && payload !== null && !(payload instanceof Uint8Array)) {
        sent.push(payload as ScanRequestMessage);
      }
    },
  };
}

function memoryBlobs(): BlobStore {
  const m = new Map<string, Uint8Array>();
  return {
    async put(k, v) {
      m.set(k, typeof v === 'string' ? new TextEncoder().encode(v) : v);
    },
    async get(k) {
      return m.get(k) ?? null;
    },
    async delete(k) {
      m.delete(k);
    },
  };
}

function buildDeps(): {
  deps: ScanBackendDeps;
  db: ReturnType<typeof memoryDb>;
  redis: ReturnType<typeof memoryRedis>;
  nats: ReturnType<typeof memoryNats>;
} {
  const db = memoryDb();
  const redis = memoryRedis();
  const nats = memoryNats();
  const blobs = memoryBlobs();
  const deps: ScanBackendDeps = {
    db,
    redis,
    nats,
    blobs,
    config: {
      brand: 'ariada',
      scorecardDepth: 'full',
      baseUrl: 'https://ariada.org',
      siblingBaseUrls: {},
      turnstileSecretKey: 'tssec',
      vpsSharedSecret: 'vpsk',
      dailyIpSaltSecret: 'salt',
      natsScanRequestSubject: 'scan.request',
    },
  };
  return { deps, db, redis, nats };
}

beforeEach(() => {
  process.env['NODE_ENV'] = 'test';
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string) => {
      if (input.endsWith('/robots.txt')) {
        return new Response('User-agent: *\nAllow: /\n', { status: 200 });
      }
      return new Response('', { status: 200 });
    }),
  );
});

/**
 * Hosts mount the router on a parent Hono whose middleware fires first; this
 * test helper mirrors that pattern.
 */
function mountWithDeps(
  deps: ScanBackendDeps,
  brand: 'ariada' | 'dracula' = 'ariada',
  scorecardDepth: 'top-5' | 'full' = 'full',
  baseUrl = 'https://ariada.org',
): Hono {
  const root = new Hono();
  root.use('*', async (c, next) => {
    c.set('deps', deps);
    await next();
  });
  const scanApp = createScanRouter({ brand, scorecardDepth, baseUrl, siblingBaseUrls: {} });
  root.route('/', scanApp);
  return root;
}

describe('createScanRouter (v0.2.0 runtime-agnostic)', () => {
  it('POST /api/scan rejects bad body', async () => {
    const { deps } = buildDeps();
    const app = mountWithDeps(deps);
    const res = await app.request('/api/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '1.2.3.4' },
      body: JSON.stringify({ foo: 'bar' }),
    });
    expect(res.status).toBe(400);
  });

  it('POST /api/scan happy path publishes a NATS message', async () => {
    const { deps, nats } = buildDeps();
    deps.config.brand = 'dracula';
    deps.config.scorecardDepth = 'top-5';
    deps.config.baseUrl = 'https://scanner.example';
    const app = mountWithDeps(deps, 'dracula', 'top-5', 'https://scanner.example');
    const res = await app.request('/api/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '9.9.9.9' },
      body: JSON.stringify({ url: 'https://example.com', turnstileToken: 'test-token' }),
    });
    expect(res.status).toBe(202);
    const j = (await res.json()) as { scan_id: string; status: string };
    expect(j.status).toBe('queued');
    expect(nats._sent).toHaveLength(1);
    expect(nats._sent[0]!.brand).toBe('dracula');
    expect(nats._sent[0]!.callback_url).toBe(
      `https://scanner.example/api/scan/${j.scan_id}/event`,
    );
  });

  it('POST /api/scan/:id/event rejects missing HMAC', async () => {
    const { deps } = buildDeps();
    const app = mountWithDeps(deps);
    const res = await app.request('/api/scan/abc/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scan_id: 'abc', event: { kind: 'scan_error', scan_id: 'abc', error: 'x' } }),
    });
    expect(res.status).toBe(401);
  });

  it('POST /api/scan/:id/event accepts valid HMAC and invokes publishEvent', async () => {
    const { deps } = buildDeps();
    const seen: Array<{ id: string; kind: string }> = [];
    deps.publishEvent = (id, ev) => {
      seen.push({ id, kind: ev.kind });
    };
    const app = mountWithDeps(deps);
    const body = JSON.stringify({
      scan_id: 'abc',
      event: { kind: 'scan_error', scan_id: 'abc', error: 'boom' },
    });
    const sig = signBody('vpsk', body);
    const res = await app.request('/api/scan/abc/event', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `HMAC-SHA256 v1:${sig}`,
      },
      body,
    });
    expect(res.status).toBe(200);
    expect(seen).toEqual([{ id: 'abc', kind: 'scan_error' }]);
  });

  it('POST /api/scorecard/:slug/cross-sell/:target rejects unknown target', async () => {
    const { deps } = buildDeps();
    const app = mountWithDeps(deps);
    const res = await app.request('/api/scorecard/abc/cross-sell/evil', {
      method: 'POST',
    });
    expect(res.status).toBe(400);
  });
});
