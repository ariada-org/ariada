// SPDX-License-Identifier: EUPL-1.2
// Copyright Agonist Development AB — see NOTICE

import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Verify a Vercel Integration webhook signature.
 *
 * Vercel signs each webhook delivery with the integration's client secret and
 * sends the HMAC-SHA1 of the raw request body, hex-encoded, in the
 * `x-vercel-signature` header. A handler that skips this check will act on any
 * forged payload, so callers MUST verify before trusting the body.
 *
 * The comparison is constant-time (`crypto.timingSafeEqual`) so an attacker
 * cannot recover the expected signature byte-by-byte via timing. A mismatched
 * length short-circuits to `false` before the timing-safe compare — the length
 * of a signature is not secret (it is fixed for a given algorithm).
 *
 * @param secret    the integration client secret configured in Vercel
 * @param rawBody   the exact raw request body bytes, as received (NOT re-serialized)
 * @param signature the value of the `x-vercel-signature` header (hex, no prefix)
 * @returns `true` only when the signature is present, well-formed, and matches
 */
export function verifyWebhook(
  secret: string,
  rawBody: string,
  signature: string | null | undefined,
): boolean {
  if (!secret || !signature) return false;

  // Vercel sends a bare 40-char hex SHA-1 digest (no algorithm prefix).
  if (!/^[0-9a-f]{40}$/i.test(signature)) return false;

  const expected = createHmac('sha1', secret).update(rawBody, 'utf8').digest('hex');

  if (expected.length !== signature.length) return false;

  return timingSafeEqual(Buffer.from(expected, 'utf8'), Buffer.from(signature.toLowerCase(), 'utf8'));
}
