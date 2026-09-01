/**
 * Attribution helpers — runtime-agnostic.
 *
 * Salvage migration: D1 → injected DbLike (Postgres in production via the
 * Node host).  The recordEvent SQL uses Postgres `$N` placeholders.
 */
import { ulid } from 'ulid';

import type { DbLike } from './deps.js';
import { eventIngestSchema, type EventIngest } from './schemas.js';

/**
 * Parse UTM + ref from a URL's search params.
 */
export function parseUtmFromUrl(url: URL): EventIngest {
  const sp = url.searchParams;
  return {
    path: url.pathname,
    utm_source: sp.get('utm_source') ?? undefined,
    utm_medium: sp.get('utm_medium') ?? undefined,
    utm_campaign: sp.get('utm_campaign') ?? undefined,
    utm_content: sp.get('utm_content') ?? undefined,
    utm_term: sp.get('utm_term') ?? undefined,
  };
}

/**
 * Read first-party cookie ariada_src from a Cookie header.
 * Returns the raw value (caller decides interpretation).
 */
export function readAriadaSrcCookie(cookieHeader: string | null | undefined): string | undefined {
  if (!cookieHeader) return undefined;
  for (const piece of cookieHeader.split(/;\s*/)) {
    const [k, v] = piece.split('=', 2);
    if (k === 'ariada_src' && v) return decodeURIComponent(v);
  }
  return undefined;
}

/**
 *
 */
export interface SetCookieArgs {
  name: string;
  value: string;
  domain?: string;
  maxAgeSec: number;
  secure?: boolean;
}

/**
 *
 */
export function makeSetCookie(args: SetCookieArgs): string {
  const parts = [
    `${args.name}=${encodeURIComponent(args.value)}`,
    `Max-Age=${args.maxAgeSec}`,
    `Path=/`,
    `SameSite=Lax`,
  ];
  if (args.domain) parts.push(`Domain=${args.domain}`);
  if (args.secure !== false) parts.push('Secure');
  parts.push('HttpOnly');
  return parts.join('; ');
}

/**
 * Insert an event row into the events table.
 */
export async function recordEvent(
  db: DbLike,
  cookieId: string | undefined,
  payload: unknown,
): Promise<void> {
  const parsed = eventIngestSchema.safeParse(payload);
  if (!parsed.success) return;
  const e = parsed.data;
  await db.execute(
    `INSERT INTO events (id, cookie_id, utm_source, utm_medium, utm_campaign, utm_content, utm_term, path, ref, at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      ulid(),
      cookieId ?? null,
      e.utm_source ?? null,
      e.utm_medium ?? null,
      e.utm_campaign ?? null,
      e.utm_content ?? null,
      e.utm_term ?? null,
      e.path ?? null,
      e.ref ?? null,
      Date.now(),
    ],
  );
}
