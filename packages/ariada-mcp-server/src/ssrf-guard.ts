// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

import { isPrivateIpv6 as isPrivateIpv6Shared } from '@ariada-org/url-guard';

import { McpServerError } from './errors.js';

/**
 * Options for the URL guard.
 */
export interface GuardOptions {
  /** When true, RFC 1918 / loopback / link-local addresses are allowed. */
  allowPrivate?: boolean;
}

const ALLOWED_SCHEMES = new Set(['http:', 'https:']);

/**
 * Parse a 32-bit IPv4 address into octets, or return null when input is not a
 * dotted-quad literal.
 */
function parseIpv4(host: string): [number, number, number, number] | null {
  const parts = host.split('.');
  if (parts.length !== 4) return null;
  const octets: number[] = [];
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p)) return null;
    const n = Number.parseInt(p, 10);
    if (n < 0 || n > 255) return null;
    octets.push(n);
  }
  return [octets[0] ?? 0, octets[1] ?? 0, octets[2] ?? 0, octets[3] ?? 0];
}

/**
 * Check whether a host is a literal private-range address per RFC 1918,
 * loopback, link-local, or CGNAT. DNS names (e.g., `localhost`) are matched
 * separately by `isLoopbackName`.
 */
export function isPrivateIpv4(host: string): boolean {
  const ip = parseIpv4(host);
  if (!ip) return false;
  const [a, b] = ip;
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 127) return true; // loopback
  if (a === 169 && b === 254) return true; // link-local
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64.0.0/10
  if (a === 0) return true; // 0.0.0.0/8
  return false;
}

const LOOPBACK_NAMES = new Set(['localhost', 'localhost.localdomain', 'ip6-localhost']);

/**
 * Match canonical loopback hostnames.
 */
export function isLoopbackName(host: string): boolean {
  return LOOPBACK_NAMES.has(host.toLowerCase());
}

/**
 * Match IPv6 loopback / link-local / unique-local literals, AND IPv4-mapped
 * IPv6 (`::ffff:a.b.c.d`) whose embedded IPv4 is private — the vector the old
 * prefix-only check missed. Delegates to the shared url-guard implementation so
 * the mapped-address normalization stays in one place.
 */
export function isPrivateIpv6(host: string): boolean {
  return isPrivateIpv6Shared(host);
}

/**
 * Validate that the given URL is safe to dispatch a scan against. Returns the
 * parsed URL on success and throws `McpServerError` (mapped to JSON-RPC
 * `SsrfRefused` / `InvalidParams`) on rejection.
 */
export function guardUrl(input: string, opts: GuardOptions = {}): URL {
  let parsed: URL;
  try {
    parsed = new URL(input);
  } catch {
    throw new McpServerError('InvalidParams', `URL is not parseable: ${input}`, {
      input,
    });
  }
  // Strict allowlist: only http: and https: pass. Every other scheme —
  // file:, data:, javascript:, vbscript:, blob:, gopher:, ftp:, ws:, … — is
  // rejected by the same branch. We do not enumerate dangerous schemes by
  // name because any such list is necessarily incomplete; an allowlist is the
  // only sound check. `URL.protocol` is the already-normalised scheme with a
  // trailing colon, so this is an exact comparison, not a substring match.
  if (!ALLOWED_SCHEMES.has(parsed.protocol)) {
    throw new McpServerError('SsrfRefused', `Scheme not permitted: ${parsed.protocol}`, {
      scheme: parsed.protocol,
    });
  }
  if (opts.allowPrivate === true) return parsed;
  const host = parsed.hostname;
  // The shared check reads an IPv4 address carried inside an IPv6 one and
  // judges that, in every notation that can carry it — so a separate clause for
  // one of those notations both repeated it and disagreed with it.
  if (isLoopbackName(host) || isPrivateIpv4(host) || isPrivateIpv6(host)) {
    throw new McpServerError(
      'SsrfRefused',
      `Private-network URL refused. Pass --allow-private to override.`,
      { host },
    );
  }
  return parsed;
}
