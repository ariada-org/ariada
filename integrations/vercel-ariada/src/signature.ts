// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Verifies the `x-vercel-signature` header Vercel sends on every
 * integration webhook: HMAC-SHA1 of the raw request body, keyed with the
 * integration's client secret, hex-encoded.
 *
 * The raw body (not a re-serialized/parsed copy) must be used, since
 * re-serialization can change byte-for-byte formatting and break the
 * signature even for a legitimate request.
 */
export function verifyVercelSignature(
  rawBody: string,
  signatureHeader: string | undefined,
  secret: string,
): boolean {
  if (!signatureHeader) {
    return false;
  }

  const expected = createHmac('sha1', secret).update(rawBody, 'utf8').digest();

  let received: Buffer;
  try {
    received = Buffer.from(signatureHeader, 'hex');
  } catch {
    return false;
  }

  if (received.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(received, expected);
}
