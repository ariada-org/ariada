// SPDX-License-Identifier: EUPL-1.2
//
// Verification — re-derives the canonical hash for each entry, checks the
// `prev_hash` link, and validates the Ed25519 signature. Deterministic and
// dependency-free; the regulator-facing Python verifier is a faithful port
// of the same algorithm.

import { computeEntryHash, GENESIS_PREV_HASH } from './attest.js';
import {
  hexToBytes,
  importEd25519PublicKeyRaw,
  verifyEd25519,
} from './crypto.js';
import type { HaesEntry, VerificationResult } from './types.js';

/**
 * Verify one entry in isolation against an expected `prev_hash` and an
 * Ed25519 public key (32 raw bytes). Returns a detailed verdict; does not
 * throw on verification failures (only on malformed input).
 */
export function verifyEntry(
  entry: HaesEntry,
  expectedPrevHash: string,
  publicKeyRaw: Uint8Array,
): VerificationResult {
  if (entry.prev_hash !== expectedPrevHash) {
    return {
      valid: false,
      failed_entry_id: entry.entry_id,
      reason:
        `prev_hash mismatch — expected ${expectedPrevHash}, ` +
        `got ${entry.prev_hash}`,
    };
  }
  const { entry_hash, signature, ...preWithExtras } = entry;
  // `preWithExtras` still has signature stripped; computeEntryHash strips tags.
  const recomputed = computeEntryHash(preWithExtras);
  if (recomputed !== entry_hash) {
    return {
      valid: false,
      failed_entry_id: entry.entry_id,
      reason:
        `entry_hash mismatch — recomputed ${recomputed}, ` +
        `stored ${entry_hash} (entry has been tampered with)`,
    };
  }
  if (signature.algorithm !== 'Ed25519') {
    return {
      valid: false,
      failed_entry_id: entry.entry_id,
      reason: `unsupported signature algorithm: ${signature.algorithm}`,
    };
  }
  const pub = importEd25519PublicKeyRaw(publicKeyRaw);
  const ok = verifyEd25519(
    pub,
    hexToBytes(entry_hash),
    hexToBytes(signature.value),
  );
  if (!ok) {
    return {
      valid: false,
      failed_entry_id: entry.entry_id,
      reason: 'Ed25519 signature verification failed',
    };
  }
  return { valid: true };
}

/**
 * Verify an entire chain of entries in sequence. Walks the `prev_hash`
 * linkage, recomputes every `entry_hash`, and validates every signature.
 *
 * `resolveKey(keyId)` MUST return the raw 32-byte public key for the entry's
 * `payload.signing_key_id`, or `null` if the key is unknown (which is a
 * verification failure).
 *
 * Returns the first failing verdict; valid=true only if every entry passes.
 */
export function verifyChain(
  entries: ReadonlyArray<HaesEntry>,
  resolveKey: (keyId: string) => Uint8Array | null,
): VerificationResult {
  let expectedPrev = GENESIS_PREV_HASH;
  for (const entry of entries) {
    const pub = resolveKey(entry.payload.signing_key_id);
    if (pub === null) {
      return {
        valid: false,
        failed_entry_id: entry.entry_id,
        reason: `unknown signing_key_id ${entry.payload.signing_key_id}`,
      };
    }
    const verdict = verifyEntry(entry, expectedPrev, pub);
    if (!verdict.valid) return verdict;
    expectedPrev = entry.entry_hash;
  }
  return { valid: true };
}
