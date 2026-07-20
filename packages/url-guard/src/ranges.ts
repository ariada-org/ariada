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

/**
 * Extract the dotted-quad tail of an IPv4-mapped IPv6 address, or return null.
 * Matches both the mixed form `::ffff:a.b.c.d` and the fully hex form
 * `::ffff:aabb:ccdd`, normalizing either to the underlying IPv4 literal so the
 * IPv4 range check runs on the real destination. This is the vector a naive
 * "IPv6 prefix" guard misses: `[::ffff:169.254.169.254]` is really 169.254.169.254.
 */
export function ipv4FromMappedIpv6(host: string): string | null {
  const h = host.replace(/^\[/, '').replace(/\]$/, '').toLowerCase();
  const mapped = /^(?:0*:)*ffff:(.+)$/.exec(h);
  if (!mapped) return null;
  const tail = mapped[1] ?? '';
  if (tail.includes('.')) {
    return parseIpv4(tail) ? tail : null;
  }
  const hex = /^([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(tail);
  if (!hex) return null;
  const hi = Number.parseInt(hex[1] ?? '', 16);
  const lo = Number.parseInt(hex[2] ?? '', 16);
  if (!Number.isFinite(hi) || !Number.isFinite(lo)) return null;
  return `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`;
}

/**
 * Return true when an IPv6 literal is loopback, link-local, or unique-local,
 * OR is an IPv4-mapped address whose embedded IPv4 is itself private. The
 * mapped-address branch is what closes the `::ffff:a.b.c.d` bypass.
 */
export function isPrivateIpv6(host: string): boolean {
  const h = host.replace(/^\[/, '').replace(/\]$/, '').toLowerCase();
  const mapped = ipv4FromMappedIpv6(host);
  if (mapped) return isPrivateIpv4(mapped);
  if (h === '::1' || h === '::') return true; // loopback / unspecified
  if (h.startsWith('fe80:') || h.startsWith('fe80::')) return true; // link-local fe80::/10
  if (/^f[cd]/.test(h)) return true; // unique-local fc00::/7
  return false;
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
