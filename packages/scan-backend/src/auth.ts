import { hmac } from '@noble/hashes/hmac';
import { sha256 } from '@noble/hashes/sha2';
import { bytesToHex } from '@noble/hashes/utils';

const enc = new TextEncoder();

/**
 * Compute HMAC-SHA256 over the body with the shared secret.
 * Header format: `Authorization: HMAC-SHA256 v1:<hex>`.
 * @patentBinding('J','IC1')
 */
export function signBody(secret: string, body: string): string {
  return bytesToHex(hmac(sha256, enc.encode(secret), enc.encode(body)));
}

/**
 *
 */
export function verifySignature(
  secret: string,
  body: string,
  authHeader: string | null | undefined,
): boolean {
  if (!authHeader) return false;
  const m = /^HMAC-SHA256\s+v1:([0-9a-f]+)$/i.exec(authHeader);
  if (!m) return false;
  const expected = signBody(secret, body);
  const got = m[1] ?? '';
  if (expected.length !== got.length) return false;
  // constant-time compare
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ got.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Hash an IP with a daily-rotated salt. SHA-256, hex.
 * Privacy contract: IP is never stored raw — only the daily-salted hash is retained.
 */
export function hashIp(ip: string, dailySalt: string): string {
  return bytesToHex(sha256(enc.encode(`${ip}|${dailySalt}`)));
}
