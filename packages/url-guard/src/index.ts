// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

import { err, ok, type Result } from 'neverthrow';

import {
  isLoopbackName,
  isPrivateAddress,
  isPrivateIpv4,
  isPrivateIpv6,
} from './ranges.js';

export {
  isLoopbackName,
  isPrivateAddress,
  isPrivateIpv4,
  isPrivateIpv6,
} from './ranges.js';

const ALLOWED_SCHEMES = new Set(['http:', 'https:']);

/** Reason a URL was refused, discriminated so callers can branch on `kind`. */
export type UrlGuardError =
  | { kind: 'unparseable'; input: string }
  | { kind: 'scheme_not_allowed'; scheme: string }
  | { kind: 'private_literal'; host: string }
  | { kind: 'private_resolved'; host: string; address: string }
  | { kind: 'resolution_failed'; host: string; reason: string };

/** Options accepted by every guard entry-point. */
export interface GuardOptions {
  /** When true, loopback/private/link-local/reserved destinations are allowed. */
  allowPrivate?: boolean;
}

/** A URL that passed the guard, with the address the connection should pin to. */
export interface GuardedUrl {
  /** The validated URL, parsed. */
  url: URL;
  /** The resolved IP the caller must pin the socket to (closes DNS-rebinding). */
  pinnedAddress: string;
  /** IP family of {@link pinnedAddress} (4 or 6). */
  family: 4 | 6;
}

/**
 * Validate scheme + host of a URL without any DNS resolution. Rejects
 * non-http(s) schemes and raw-IP-literal hosts (including bracketed IPv6 and
 * IPv4-mapped IPv6) that sit in a loopback/private/link-local/reserved range.
 * Hostnames that are not IP literals pass this synchronous check and must be
 * resolved by {@link resolveAndGuard} before any fetch.
 */
export function assertSafeUrl(input: string, opts: GuardOptions = {}): Result<URL, UrlGuardError> {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return err({ kind: 'unparseable', input });
  }
  if (!ALLOWED_SCHEMES.has(url.protocol)) {
    return err({ kind: 'scheme_not_allowed', scheme: url.protocol });
  }
  if (opts.allowPrivate === true) return ok(url);
  const host = url.hostname;
  // `isPrivateIpv6` reads an address carried inside another and judges that,
  // so a separate clause for one of those notations both duplicated it and
  // disagreed with it: it refused every mapped address, including a public one.
  if (isLoopbackName(host) || isPrivateIpv4(host) || isPrivateIpv6(host)) {
    return err({ kind: 'private_literal', host });
  }
  return ok(url);
}

/**
 * Full guard: run {@link assertSafeUrl}, then resolve the hostname to EVERY
 * address (`dns.lookup` with `all: true`) and reject if ANY resolved address is
 * private — a host that returns one public and one loopback address is refused.
 * Returns the validated URL plus the address the caller MUST pin the connection
 * to, so the socket cannot be re-pointed between this check and the fetch.
 */
export async function resolveAndGuard(
  input: string,
  opts: GuardOptions = {},
): Promise<Result<GuardedUrl, UrlGuardError>> {
  const safe = assertSafeUrl(input, opts);
  if (safe.isErr()) return err(safe.error);
  const url = safe.value;
  if (opts.allowPrivate === true) {
    return ok({ url, pinnedAddress: url.hostname, family: url.hostname.includes(':') ? 6 : 4 });
  }
  const host = url.hostname;

  // An address needs no looking up — it is already the destination, and it has
  // just been checked. Asking anyway fails: a URL keeps an IPv6 literal in its
  // brackets, and no resolver accepts those, so every site reachable only by an
  // IPv6 address was refused for a lookup that never should have happened.
  const literal = host.replace(/^\[/, '').replace(/\]$/, '');
  const literalFamily = isIP(literal);
  if (literalFamily === 4 || literalFamily === 6) {
    return ok({ url, pinnedAddress: literal, family: literalFamily });
  }

  let records: Array<{ address: string; family: number }>;
  try {
    records = await lookup(host, { all: true });
  } catch (e) {
    return err({ kind: 'resolution_failed', host, reason: e instanceof Error ? e.message : String(e) });
  }
  if (records.length === 0) {
    return err({ kind: 'resolution_failed', host, reason: 'no addresses' });
  }
  for (const rec of records) {
    if (isPrivateAddress(rec.address)) {
      return err({ kind: 'private_resolved', host, address: rec.address });
    }
  }
  const first = records[0];
  if (!first) return err({ kind: 'resolution_failed', host, reason: 'no addresses' });
  return ok({ url, pinnedAddress: first.address, family: first.family === 6 ? 6 : 4 });
}

/**
 * Re-check a redirect `Location` before following it. A redirect target is a
 * fresh, attacker-influenced URL, so it gets the same resolution + range guard
 * as the original — the standard way URL allowlists are defeated is a public
 * host that 302-redirects to a private one. Relative `Location` values are
 * resolved against `base` first.
 */
export async function guardRedirect(
  location: string,
  base: string,
  opts: GuardOptions = {},
): Promise<Result<GuardedUrl, UrlGuardError>> {
  let absolute: string;
  try {
    absolute = new URL(location, base).toString();
  } catch {
    return err({ kind: 'unparseable', input: location });
  }
  return resolveAndGuard(absolute, opts);
}
