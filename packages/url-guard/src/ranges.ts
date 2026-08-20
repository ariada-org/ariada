// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

import { isIP } from 'node:net';

/**
 * Parse a dotted-quad IPv4 literal into four octets, or return null when the
 * input is not a canonical dotted-quad. Only decimal `a.b.c.d` with each octet
 * in 0..255 is accepted; decimal-integer, hex, and octal encodings are handled
 * upstream by WHATWG URL host normalization, which rewrites them to this form.
 */
export function parseIpv4(host: string): [number, number, number, number] | null {
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
 * Return true when the dotted-quad address falls in a loopback, private,
 * link-local, carrier-grade-NAT, or reserved range that must never be reached
 * from a server-side fetch. Non-IPv4 input returns false (checked elsewhere).
 */
export function isPrivateIpv4(host: string): boolean {
  const ip = parseIpv4(host);
  if (!ip) return false;
  const [a, b] = ip;
  if (a === 10) return true; // 10.0.0.0/8 private
  if (a === 127) return true; // 127.0.0.0/8 loopback
  if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local (cloud metadata)
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12 private
  if (a === 192 && b === 168) return true; // 192.168.0.0/16 private
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 CGNAT
  if (a === 0) return true; // 0.0.0.0/8 reserved / "this network"
  return false;
}

/** The eight sixteen-bit groups of an IPv6 address, or null if it is not one.
 *
 *  Comparing the text of an address answers questions about the text. `::1`
 *  and `0:0:0:0:0:0:0:1` are the same address written two ways, and a check
 *  that recognised only the first said loopback was not loopback for the
 *  second. Expanding first means the tests below are about the address. */
export function ipv6Groups(host: string): number[] | null {
  // A zone identifier says which interface, not which address. Cut it with
  // string operations rather than a pattern: `%.*$` has to back off and retry
  // for every `%` in a string that has no line end after them, so a host made
  // of nothing but `%` would make the guard the slow part of the request.
  let h = host.toLowerCase();
  if (h.startsWith('[')) h = h.slice(1);
  if (h.endsWith(']')) h = h.slice(0, -1);
  const zone = h.indexOf('%');
  if (zone !== -1) h = h.slice(0, zone);
  if (isIP(h) !== 6) return null;

  // A trailing dotted quad occupies the last two groups.
  let text = h;
  const dotted = /:((?:\d{1,3}\.){3}\d{1,3})$/.exec(text);
  if (dotted) {
    const quad = (dotted[1] ?? '').split('.').map(Number);
    const hi = ((quad[0] ?? 0) << 8) | (quad[1] ?? 0);
    const lo = ((quad[2] ?? 0) << 8) | (quad[3] ?? 0);
    text = `${text.slice(0, dotted.index)}:${hi.toString(16)}:${lo.toString(16)}`;
  }

  const [head, tail] = text.includes('::') ? text.split('::') : [text, undefined];
  const left = head ? head.split(':').filter(Boolean) : [];
  const right = tail ? tail.split(':').filter(Boolean) : [];
  const missing = 8 - left.length - right.length;
  if (missing < 0 || (tail === undefined && missing !== 0)) return null;

  const groups = [...left, ...Array.from({ length: missing }, () => '0'), ...right].map((g) =>
    Number.parseInt(g, 16),
  );
  return groups.length === 8 && groups.every((g) => Number.isFinite(g)) ? groups : null;
}

/** The IPv4 address an IPv6 address carries inside it, or null.
 *
 *  Several notations put an IPv4 address inside an IPv6 one, and a guard that
 *  knows only the common mapped form leaves the others open. The one that
 *  matters in practice is the translation prefix: on a host with no IPv4 at
 *  all, that is how it still reaches an IPv4-only address — including the one
 *  a cloud provider answers configuration on. */
export function ipv4InsideIpv6(host: string): string | null {
  const g = ipv6Groups(host);
  if (!g) return null;

  const quad = (hi: number, lo: number): string =>
    `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`;
  const zero = (from: number, to: number): boolean => g.slice(from, to).every((x) => x === 0);

  // ::ffff:a.b.c.d — mapped, and the form nearly every guard knows.
  if (zero(0, 5) && g[5] === 0xffff) return quad(g[6] ?? 0, g[7] ?? 0);
  // ::ffff:0:a.b.c.d — translated.
  if (zero(0, 4) && g[4] === 0xffff && g[5] === 0) return quad(g[6] ?? 0, g[7] ?? 0);
  // 64:ff9b::a.b.c.d and 64:ff9b:1::/48 — translation, the live one.
  if (g[0] === 0x0064 && g[1] === 0xff9b) return quad(g[6] ?? 0, g[7] ?? 0);
  // 2002:a.b.c.d:: — the old tunnelling prefix.
  if (g[0] === 0x2002) return quad(g[1] ?? 0, g[2] ?? 0);
  // ::a.b.c.d — compatible; deprecated, and still routed by some stacks.
  if (zero(0, 6) && !(g[6] === 0 && (g[7] ?? 0) <= 1)) return quad(g[6] ?? 0, g[7] ?? 0);

  return null;
}

/**
 * Whether an IPv6 address is one nothing outside this machine or network
 * should be asked to fetch.
 *
 * Everything here works on the address rather than on how it was written.
 * A hostname is not an address and is never private by this test — reading
 * one as an address refused every host whose name began fc or fd.
 */
export function isPrivateIpv6(host: string): boolean {
  const embedded = ipv4InsideIpv6(host);
  if (embedded) return isPrivateIpv4(embedded);

  const g = ipv6Groups(host);
  if (!g) return false;

  if (g.every((x) => x === 0)) return true; // :: — unspecified
  if (zeroExceptLast(g) && g[7] === 1) return true; // ::1 — loopback
  if (((g[0] ?? 0) & 0xffc0) === 0xfe80) return true; // fe80::/10 — link-local
  if (((g[0] ?? 0) & 0xfe00) === 0xfc00) return true; // fc00::/7 — unique-local
  return false;
}

function zeroExceptLast(groups: number[]): boolean {
  return groups.slice(0, 7).every((x) => x === 0);
}

const LOOPBACK_NAMES = new Set(['localhost', 'localhost.localdomain', 'ip6-localhost']);

/**
 * Match canonical loopback hostnames that resolve to the local machine even
 * though they are not IP literals.
 */
export function isLoopbackName(host: string): boolean {
  return LOOPBACK_NAMES.has(host.toLowerCase());
}

/**
 * Return true when a raw IP address string (v4 or v6) belongs to a range no
 * server-side fetch may reach. Non-IP input returns false — hostnames are
 * resolved to addresses first and each resolved address is checked here.
 */
export function isPrivateAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return isPrivateIpv4(address);
  if (family === 6) return isPrivateIpv6(address);
  // Not a bare IP literal: fall back to the textual checks so bracketed or
  // mapped forms that `isIP` rejects are still classified.
  return isPrivateIpv6(address);
}
