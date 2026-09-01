/**
 * createScanRouter — runtime-agnostic factory used by services/backend.
 *
 * Salvage migration v0.2.0 (2026-04-27, ADR-003):
 *   Hono<{ Bindings: ScanBackendBindings }>      ← CF Workers / DO / D1 / KV / Queue
 *   Hono<{ Variables: ScanBackendVars }>          ← Node + injected ScanBackendDeps
 *
 * @patentBinding('J','IC1')
 * @patentBinding('K','IC1')
 */
import { Hono } from 'hono';
import type { Context } from 'hono';
import { nanoid } from 'nanoid';
import { ulid } from 'ulid';

import {
  parseUtmFromUrl,
  readAriadaSrcCookie,
  recordEvent,
  makeSetCookie,
} from './attribution.js';
import { hashIp, verifySignature } from './auth.js';
import type { ScanBackendDeps } from './deps.js';
import { checkScanRateLimit, redisAsKv } from './rate-limit.js';
import { isScanAllowed } from './robots-check.js';
import {
  scanInitiateSchema,
  scanCallbackBodySchema,
  type ScanRequestMessage,
} from './schemas.js';

/**
 *
 */
export interface ScanBackendConfig {
  brand: 'ariada' | 'dracula';
  scorecardDepth: 'top-5' | 'full';
  crossSellTargets?: Array<'ariada' | 'blamer' | 'clamper' | 'reverter'>;
  baseUrl: string;
  siblingBaseUrls: Record<string, string>;
}

/** Hono Variables surface for the router. Hosts MUST register a middleware
 *  that sets `deps` BEFORE forwarding requests to this router. */
export interface ScanBackendVars {
  deps: ScanBackendDeps;
}

type AppEnv = { Variables: ScanBackendVars };

const TURNSTILE_VERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

async function verifyTurnstile(secret: string, token: string, ip?: string): Promise<boolean> {
  if (process.env['NODE_ENV'] === 'test' && token === 'test-token') return true;
  if (process.env['ARIADA_BACKEND_DEV_BYPASS_TURNSTILE'] === '1') return true;
  try {
    const body = new URLSearchParams({ secret, response: token });
    if (ip) body.set('remoteip', ip);
    const res = await fetch(TURNSTILE_VERIFY, { method: 'POST', body });
    if (!res.ok) return false;
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}

function clientIp(c: Context<AppEnv>): string {
  const cf = c.req.header('CF-Connecting-IP');
  if (cf) return cf;
  const xff = c.req.header('X-Forwarded-For');
  if (xff) return xff.split(',')[0]?.trim() ?? '0.0.0.0';
  const realIp = c.req.header('X-Real-IP');
  if (realIp) return realIp;
  return '0.0.0.0';
}

/**
 * ipHash + cookieId derived per-request inside each route handler. We
 * intentionally avoid a top-level `app.use('*', ipHashMw)` so the host can
 * register its deps-injection middleware ahead of these derivations (Hono
 * runs middlewares in the order they are added on a given Hono instance).
 */
function deriveIpHash(c: Context<AppEnv>): string {
  const ip = clientIp(c);
  const deps = c.var.deps;
  return hashIp(ip, deps.config.dailyIpSaltSecret);
}

function deriveCookieId(c: Context<AppEnv>): string | undefined {
  return readAriadaSrcCookie(c.req.header('Cookie'));
}

/**
 *
 */
export function createScanRouter(config: ScanBackendConfig): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  // -- POST /api/scan ----------------------------------------------------------
  app.post('/api/scan', async (c) => {
    const deps = c.var.deps;
    const raw = await c.req.json().catch(() => null);
    const parsed = scanInitiateSchema.safeParse(raw);
    if (!parsed.success) return c.json({ error: 'invalid body' }, 400);
    const { url, turnstileToken } = parsed.data;

    if (!(await verifyTurnstile(deps.config.turnstileSecretKey, turnstileToken, clientIp(c)))) {
      return c.json({ error: 'turnstile_failed' }, 403);
    }

    let target: URL;
    try {
      target = new URL(url);
    } catch {
      return c.json({ error: 'invalid_url' }, 400);
    }

    const ipHash = deriveIpHash(c);
    const decision = await checkScanRateLimit(redisAsKv(deps.redis), ipHash, target.host);
    if (!decision.ok) {
      return c.json(
        { error: 'rate_limited', reason: decision.reason, retry_after_sec: decision.retryAfterSec },
        429,
      );
    }

    if (!(await isScanAllowed(target.toString()))) {
      return c.json({ error: 'robots_disallowed' }, 403);
    }

    const scanId = ulid();
    const requestedAt = Date.now();
    await deps.db.execute(
      `INSERT INTO scans (id, url, url_host, requested_at, status, ip_hash, turnstile_ok)
       VALUES ($1, $2, $3, $4, 'queued', $5, 1)`,
      [scanId, target.toString(), target.host, requestedAt, ipHash],
    );

    const callback = `${config.baseUrl}/api/scan/${scanId}/event`;
    const msg: ScanRequestMessage = {
      brand: config.brand,
      scan_id: scanId,
      url: target.toString(),
      callback_url: callback,
      hmac_key_id: 'v1',
      requested_at: requestedAt,
    };
    await deps.nats.publish(deps.config.natsScanRequestSubject, msg);

    return c.json({ scan_id: scanId, status: 'queued' }, 202);
  });

  // -- GET /api/scan/:id/stream ------------------------------------------------
  // Note: in the Node host, stream wiring is handled by the server entrypoint
  // (see services/backend/src/sse.ts). This router exposes a 501 placeholder so
  // unit tests against the router-only surface still pass; the host overrides
  // this route with its own SSE-aware handler before mounting.
  app.get('/api/scan/:id/stream', async (c): Promise<Response> => {
    return c.json({ error: 'sse_handler_must_be_provided_by_host' }, 501);
  });

  // -- POST /api/scan/:id/event  ← scanner callback ----------------------------
  app.post('/api/scan/:id/event', async (c) => {
    const deps = c.var.deps;
    const id = c.req.param('id');
    const bodyText = await c.req.text();
    if (!verifySignature(deps.config.vpsSharedSecret, bodyText, c.req.header('Authorization'))) {
      return c.json({ error: 'unauthorized' }, 401);
    }
    let parsed;
    try {
      parsed = scanCallbackBodySchema.parse(JSON.parse(bodyText));
    } catch {
      return c.json({ error: 'invalid_body' }, 400);
    }
    if (parsed.scan_id !== id) return c.json({ error: 'scan_id_mismatch' }, 400);

    // persist event for replay/debug
    const seq = (parsed.event as { seq?: number }).seq ?? 0;
    await deps.db.execute(
      `INSERT INTO scan_events (scan_id, seq, ts, kind, payload)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (scan_id, seq) DO NOTHING`,
      [id, seq, Date.now(), parsed.event.kind, JSON.stringify(parsed.event)],
    );

    // on scan_complete persist scorecard
    if (parsed.event.kind === 'scan_complete') {
      const slug = nanoid(12);
      await deps.db.execute(
        `UPDATE scans SET completed_at = $1, status = 'complete' WHERE id = $2`,
        [Date.now(), id],
      );
      const scanRow = await deps.db.queryOne<{ url: string }>(
        `SELECT url FROM scans WHERE id = $1`,
        [id],
      );
      if (scanRow) {
        const ev = parsed.event;
        await deps.db.execute(
          `INSERT INTO scorecards
            (slug, scan_id, url, score,
             critical_count, serious_count, moderate_count, minor_count,
             top_categories, created_at, public, expires_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 1, $11)`,
          [
            slug,
            id,
            scanRow.url,
            ev.score,
            ev.counts.critical,
            ev.counts.serious,
            ev.counts.moderate,
            ev.counts.minor,
            JSON.stringify(ev.top_categories),
            Date.now(),
            Date.now() + 90 * 24 * 60 * 60 * 1000,
          ],
        );
      }
    } else if (parsed.event.kind === 'scan_error') {
      await deps.db.execute(
        `UPDATE scans SET completed_at = $1, status = 'failed', error = $2 WHERE id = $3`,
        [Date.now(), parsed.event.error, id],
      );
    }

    // Forward to host SSE registry if available. Cast bridges
    // zod-parsed shape (where optional fields are explicitly `T | undefined`)
    // to the ScanEvent union (which uses `T?` under exactOptionalPropertyTypes).
    deps.publishEvent?.(id, parsed.event as Parameters<NonNullable<typeof deps.publishEvent>>[1]);

    return c.json({ ok: true });
  });

  // -- GET /api/scorecard/:slug -----------------------------------------------
  app.get('/api/scorecard/:slug', async (c) => {
    const deps = c.var.deps;
    const slug = c.req.param('slug');
    const row = await deps.db.queryOne<Record<string, unknown>>(
      `SELECT slug, url, score,
              critical_count, serious_count, moderate_count, minor_count,
              top_categories, screenshot_key, og_image_key, created_at, view_count
         FROM scorecards WHERE slug = $1 AND public = 1`,
      [slug],
    );
    if (!row) return c.json({ error: 'not_found' }, 404);
    await deps.db.execute(
      `UPDATE scorecards SET view_count = view_count + 1 WHERE slug = $1`,
      [slug],
    );
    const depth = config.scorecardDepth;
    const top = JSON.parse(String(row['top_categories'] ?? '[]')) as Array<{
      rule_id: string;
      count: number;
    }>;
    return c.json({
      slug: row['slug'],
      url: row['url'],
      score: row['score'],
      counts: {
        critical: row['critical_count'],
        serious: row['serious_count'],
        moderate: row['moderate_count'],
        minor: row['minor_count'],
      },
      top_categories: depth === 'full' ? top : top.slice(0, 5),
      depth,
      brand: config.brand,
    });
  });

  // -- GET /api/badge/:domain --------------------------------------------------
  app.get('/api/badge/:domain', async (c) => {
    const deps = c.var.deps;
    const domain = c.req.param('domain');
    const cacheKey = `badge:${domain}`;
    const cached = await deps.redis.get(cacheKey);
    if (cached) {
      return new Response(cached, {
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=86400' },
      });
    }
    const row = await deps.db.queryOne<{ score: number; slug: string; created_at: number }>(
      `SELECT score, slug, created_at FROM scorecards
        WHERE url LIKE $1
        ORDER BY created_at DESC LIMIT 1`,
      [`%//${domain}%`],
    );
    const body = JSON.stringify(
      row
        ? { domain, score: row.score, slug: row.slug, scanned_at: row.created_at }
        : { domain, score: null },
    );
    await deps.redis.set(cacheKey, body, { exSec: 86400 });
    return new Response(body, {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=86400' },
    });
  });

  // -- POST /api/events --------------------------------------------------------
  app.post('/api/events', async (c) => {
    const deps = c.var.deps;
    const url = new URL(c.req.url);
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
    const merged = { ...parseUtmFromUrl(url), ...body };
    const cookieId = deriveCookieId(c);
    let setCookie: string | undefined;
    let nextCookieId = cookieId;
    if (!nextCookieId) {
      nextCookieId = ulid();
      setCookie = makeSetCookie({
        name: 'ariada_src',
        value: nextCookieId,
        maxAgeSec: 30 * 24 * 60 * 60,
      });
    }
    await recordEvent(deps.db, nextCookieId, merged);
    if (setCookie) {
      return new Response(JSON.stringify({ ok: true }), {
        headers: { 'Content-Type': 'application/json', 'Set-Cookie': setCookie },
      });
    }
    return c.json({ ok: true });
  });

  // -- POST /api/scorecard/:slug/cross-sell/:target ----------------------------
  app.post('/api/scorecard/:slug/cross-sell/:target', async (c) => {
    const deps = c.var.deps;
    const slug = c.req.param('slug');
    const target = c.req.param('target');
    if (!['ariada', 'blamer', 'clamper', 'reverter'].includes(target)) {
      return c.json({ error: 'invalid_target' }, 400);
    }
    await deps.db.execute(
      `INSERT INTO scorecard_cross_sells (scorecard_slug, target, clicks)
       VALUES ($1, $2, 1)
       ON CONFLICT (scorecard_slug, target) DO UPDATE SET clicks = scorecard_cross_sells.clicks + 1`,
      [slug, target],
    );
    return c.json({ ok: true });
  });

  return app;
}
