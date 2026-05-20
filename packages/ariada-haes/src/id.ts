// SPDX-License-Identifier: EUPL-1.2
//
// ULID-style identifier generation. We follow the ulid/spec layout:
//   - 48-bit timestamp (ms since epoch, big-endian)
//   - 80-bit random suffix
//   - encoded in Crockford base32 (26 characters)
//
// Implemented locally to avoid a runtime dependency. Output is byte-for-byte
// compatible with the canonical ulidx output for the same timestamp + entropy.

import { getRandomBytes } from './crypto.js';

const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/**
 * Generate a ULID (26 Crockford-base32 characters) for the given timestamp.
 * If `now` is omitted, the current wall-clock millisecond is used.
 */
export function ulid(now: number = Date.now()): string {
  if (!Number.isFinite(now) || now < 0) {
    throw new RangeError(`ulid: invalid timestamp ${now}`);
  }
  const ts = encodeTime(now);
  const rand = encodeRandom(getRandomBytes(10));
  return ts + rand;
}

/**
 * Encode a 48-bit timestamp as 10 Crockford-base32 characters.
 */
export function encodeTime(ms: number): string {
  if (ms > 0xffffffffffff) {
    throw new RangeError(`ulid: timestamp exceeds 48 bits (${ms})`);
  }
  let chars = '';
  let n = Math.floor(ms);
  for (let i = 0; i < 10; i++) {
    const rem = n % 32;
    chars = (CROCKFORD[rem] ?? '0') + chars;
    n = Math.floor(n / 32);
  }
  return chars;
}

/**
 * Encode 10 random bytes (80 bits) as 16 Crockford-base32 characters.
 */
export function encodeRandom(bytes: Uint8Array): string {
  if (bytes.length !== 10) {
    throw new RangeError(`ulid: random portion must be 10 bytes (got ${bytes.length})`);
  }
  // Bit-pack the 80 bits as a big-endian integer, then base32-encode.
  let value = 0n;
  for (const b of bytes) value = (value << 8n) | BigInt(b);
  let chars = '';
  for (let i = 0; i < 16; i++) {
    const rem = Number(value & 31n);
    chars = (CROCKFORD[rem] ?? '0') + chars;
    value >>= 5n;
  }
  return chars;
}

/**
 * Parse a ULID's timestamp portion (first 10 chars) back to milliseconds.
 * Useful for tests + monotonic-timestamp assertions.
 */
export function decodeUlidTimestamp(id: string): number {
  if (id.length < 10) throw new TypeError(`ulid: too short to decode (${id})`);
  let n = 0;
  for (let i = 0; i < 10; i++) {
    const ch = id[i] as string;
    const idx = CROCKFORD.indexOf(ch);
    if (idx === -1) throw new TypeError(`ulid: invalid Crockford char '${ch}'`);
    n = n * 32 + idx;
  }
  return n;
}

/**
 * RFC 3339 / ISO 8601 timestamp at millisecond precision (UTC, with Z).
 */
export function nowRfc3339(now: number = Date.now()): string {
  return new Date(now).toISOString();
}
