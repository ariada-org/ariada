// SPDX-License-Identifier: EUPL-1.2
//
// SHA-256 helpers wrapping Node 22 `node:crypto`. Zero runtime deps.

import { createHash } from 'node:crypto';

/** SHA-256 over a UTF-8 string, hex output. */
export function sha256Hex(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

/** SHA-256 over raw bytes, hex output. */
export function sha256BytesHex(input: Uint8Array): string {
  return createHash('sha256').update(input).digest('hex');
}
