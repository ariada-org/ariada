// SPDX-License-Identifier: EUPL-1.2
//
// Attestation construction — turns an `AppendInput` plus the chain's current
// tail hash into a fully-signed `HaesEntry` ready for persistence.
//
// The implementation is split out from the client so that downstream
// re-implementers (Python verifier, Rust port, audit tools) can test the
// canonical pre-image / hash / signature pipeline independently from any
// storage backend.

import { canonicalize } from './canonical.js';
import {
  bytesToHex,
  hexToBytes,
  sha256Hex,
  signEd25519,
  type Ed25519Keypair,
} from './crypto.js';
import { nowRfc3339, ulid } from './id.js';
import type {
  AppendInput,
  EntryPayload,
  EntrySignature,
  HaesEntry,
  SignatureAlgorithm,
} from './types.js';

/**
 * The current AIAS canonical schema version produced by this package.
 *
 * Bumped on any breaking field-shape change. Minor field additions with
 * default values get a minor bump; pure clarifications get a patch bump.
 */
export const AIAS_SCHEMA_VERSION = '1.0.0';

/** Genesis-entry sentinel for `prev_hash` (no prior entry exists). */
export const GENESIS_PREV_HASH = '0'.repeat(64);

/** Default signature algorithm. */
export const DEFAULT_SIGNATURE_ALGORITHM: SignatureAlgorithm = 'Ed25519';

/**
 * Build the canonical pre-image for an entry's hash. Mirrors §3.2 of the
 * Authorship anchoring specification:
 *
 *   1. Drop the `entry_hash` field itself.
 *   2. Drop the `signature` field (signed AFTER hash).
 *   3. Drop `payload.tags` (privacy + churn isolation).
 *   4. JCS-canonicalize the resulting object (RFC 8785).
 *   5. UTF-8 encode the string and SHA-256 it.
 *
 * Returned as 64-char lowercase hex.
 */
export function computeEntryHash(
  entry: Omit<HaesEntry, 'entry_hash' | 'signature'>,
): string {
  const { payload, ...rest } = entry;
  const payloadNoTags: EntryPayload = { ...payload };
  delete payloadNoTags.tags;
  const preImage = { ...rest, payload: payloadNoTags };
  const canonical = canonicalize(preImage);
  return sha256Hex(canonical);
}

/**
 * Sign an entry's hash with an Ed25519 keypair. The signature is taken over
 * the RAW 32-byte SHA-256 digest, not the hex string — this matches the
 * spec and the cross-language verifier.
 */
export function signEntryHash(
  entryHashHex: string,
  key: Ed25519Keypair,
): EntrySignature {
  const sig = signEd25519(key.privateKey, hexToBytes(entryHashHex));
  return {
    algorithm: DEFAULT_SIGNATURE_ALGORITHM,
    value: bytesToHex(sig),
  };
}

/**
 * Build a fully-attested entry from the caller's append-input and chain tail.
 *
 * `chainPrevHash`:
 *   - `GENESIS_PREV_HASH` for the very first entry
 *   - the prior entry's `entry_hash` for every subsequent entry
 *
 * `key`:
 *   - signing keypair whose `keyId` (sha256 of raw pubkey) is recorded in
 *     `payload.signing_key_id`. The caller is expected to supply a payload
 *     with `signing_key_id === key.keyId`, mirroring the production flow.
 *     We assert equality to surface configuration errors early.
 */
export function buildEntry(
  input: AppendInput,
  chainPrevHash: string,
  key: Ed25519Keypair,
): HaesEntry {
  if (input.payload.signing_key_id !== key.keyId) {
    throw new Error(
      `signing_key_id (${input.payload.signing_key_id}) does not match the ` +
        `keypair's keyId (${key.keyId}). The payload's signing_key_id must ` +
        `equal sha256Hex(rawPublicKey) of the supplied private key.`,
    );
  }
  if (!/^[0-9a-f]{64}$/.test(chainPrevHash)) {
    throw new TypeError(`chainPrevHash must be 64 lowercase hex chars`);
  }

  const timestamp = input.timestamp ?? nowRfc3339();
  const entry_id = input.entry_id ?? ulid(Date.parse(timestamp));
  const schema_version = input.schema_version ?? AIAS_SCHEMA_VERSION;

  const pre: Omit<HaesEntry, 'entry_hash' | 'signature'> = {
    entry_id,
    timestamp,
    prev_hash: chainPrevHash,
    payload: input.payload,
    schema_version,
    ...(input.tenant_id !== undefined ? { tenant_id: input.tenant_id } : {}),
  };
  const entry_hash = computeEntryHash(pre);
  const signature = signEntryHash(entry_hash, key);
  return { ...pre, entry_hash, signature };
}
