// SPDX-License-Identifier: EUPL-1.2
// Copyright Agonist Development AB — see NOTICE

import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Verify a GitHub webhook signature.
 *
 * GitHub signs each webhook delivery with the app's configured secret and
 * sends the result in the `X-Hub-Signature-256` header as `sha256=<hex>`.
 * A handler that skips this check will act on any forged payload, so callers
 * MUST verify before trusting the body.
 *
 * The comparison is constant-time (`crypto.timingSafeEqual`) so an attacker
 * cannot recover the expected signature byte-by-byte via timing. A mismatched
 * length short-circuits to `false` before the timing-safe compare — the length
 * of a signature is not secret (it is fixed for a given algorithm).
 *
 * @param secret    the shared webhook secret configured on the GitHub App
 * @param rawBody   the exact raw request body bytes, as received (NOT re-serialized)
 * @param signature the value of the `X-Hub-Signature-256` header (e.g. `sha256=abc…`)
 * @returns `true` only when the signature is present, well-formed, and matches
 */
export function verifyWebhook(
  secret: string,
  rawBody: string,
  signature: string | null | undefined,
): boolean {
  if (!secret || !signature) return false;

  const match = /^sha256=([0-9a-f]{64})$/i.exec(signature);
  if (!match) return false;
  const provided = match[1] ?? '';

  const expected = createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');

  // Length is fixed (64 hex chars) but guard anyway so timingSafeEqual never
  // throws on a length mismatch.
  if (expected.length !== provided.length) return false;

  return timingSafeEqual(Buffer.from(expected, 'utf8'), Buffer.from(provided.toLowerCase(), 'utf8'));
}
