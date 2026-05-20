// SPDX-License-Identifier: EUPL-1.2
//
// Merkle anchor — daily-anchor commitment construction. Builds a binary
// SHA-256 Merkle tree over a set of entry hashes (leaves), produces the
// canonical root, and emits inclusion proofs.
//
// Conventions:
//   - Leaf hash is the entry's `entry_hash` (already SHA-256 of canonical
//     pre-image). We do NOT re-hash leaves — keeping the leaf-to-root
//     transformation byte-faithful to the entry's existing commitment.
//   - Internal nodes: H(left || right) with raw 32-byte concatenation.
//   - Odd-leaf handling (RFC 6962 §2.1): a lone right-most leaf at a level
//     is promoted unchanged to the next level (no self-pairing). This
//     produces strict inclusion proofs with no ambiguity.

import { bytesToHex, hexToBytes, sha256Bytes, sha256Hex } from './crypto.js';
import type { MerkleInclusionProof, MerkleProofStep, Sha256Hex } from './types.js';

/**
 * Build the Merkle root over a list of leaf hashes (each 64-char hex).
 *
 * Returns `null` for an empty input (no anchor possible for an empty day).
 */
export function buildMerkleRoot(leaves: ReadonlyArray<Sha256Hex>): Sha256Hex | null {
  if (leaves.length === 0) return null;
  let level: Uint8Array[] = leaves.map((h) => hexToBytes(h));
  while (level.length > 1) {
    const next: Uint8Array[] = [];
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i] as Uint8Array;
      const right = level[i + 1];
      if (right === undefined) {
        // Odd-leaf promotion.
        next.push(left);
      } else {
        next.push(hashPair(left, right));
      }
    }
    level = next;
  }
  return bytesToHex(level[0] as Uint8Array);
}

/**
 * Build a Merkle inclusion proof for the leaf at `leafIndex` (0-based) in
 * the provided ordered list of leaves.
 *
 * Throws RangeError if `leafIndex` is out of range or `leaves` is empty.
 */
export function buildInclusionProof(
  leaves: ReadonlyArray<Sha256Hex>,
  leafIndex: number,
): MerkleInclusionProof {
  if (leaves.length === 0) {
    throw new RangeError('cannot build inclusion proof: leaves is empty');
  }
  if (leafIndex < 0 || leafIndex >= leaves.length) {
    throw new RangeError(
      `leafIndex ${leafIndex} out of range [0, ${leaves.length})`,
    );
  }
  const leaf = leaves[leafIndex] as Sha256Hex;
  let level: Uint8Array[] = leaves.map((h) => hexToBytes(h));
  let idx = leafIndex;
  const path: MerkleProofStep[] = [];
  while (level.length > 1) {
    const next: Uint8Array[] = [];
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i] as Uint8Array;
      const right = level[i + 1];
      // Record sibling for the proof BEFORE we collapse this pair.
      if (i === idx || i + 1 === idx) {
        if (right === undefined) {
          // Odd-leaf promotion — no sibling at this level.
        } else if (i === idx) {
          path.push({ sibling: bytesToHex(right), direction: 'R' });
        } else {
          path.push({ sibling: bytesToHex(left), direction: 'L' });
        }
      }
      next.push(right === undefined ? left : hashPair(left, right));
    }
    idx = Math.floor(idx / 2);
    level = next;
  }
  return { leaf, path, root: bytesToHex(level[0] as Uint8Array) };
}

/**
 * Verify that a leaf, when walked up via the supplied proof, yields the
 * expected root. Returns true on success, false on any mismatch.
 */
export function verifyInclusionProof(
  proof: MerkleInclusionProof,
  expectedRoot: Sha256Hex,
): boolean {
  if (proof.root !== expectedRoot) return false;
  let current = hexToBytes(proof.leaf);
  for (const step of proof.path) {
    const sibling = hexToBytes(step.sibling);
    current =
      step.direction === 'R' ? hashPair(current, sibling) : hashPair(sibling, current);
  }
  return bytesToHex(current) === expectedRoot;
}

/**
 * Concatenate two 32-byte hashes and SHA-256 the result.
 */
function hashPair(left: Uint8Array, right: Uint8Array): Uint8Array {
  const concat = new Uint8Array(left.length + right.length);
  concat.set(left, 0);
  concat.set(right, left.length);
  return sha256Bytes(concat);
}

/**
 * Convenience helper: compute the root over a set of `HaesEntry` objects
 * by extracting each one's `entry_hash`. Sort order is the responsibility
 * of the caller (typically `entry_id` ascending — equal to ULID order).
 */
export function rootOverEntryHashes(entryHashes: ReadonlyArray<string>): Sha256Hex | null {
  return buildMerkleRoot(entryHashes);
}

/**
 * Build a single-day anchor manifest — the root + per-leaf positions —
 * suitable for publishing to a public log alongside an Ed25519-signed root.
 *
 * `dayKey` is opaque to the function but typically `YYYY-MM-DD` UTC.
 */
export interface AnchorManifest {
  day: string;
  root: Sha256Hex;
  leaf_count: number;
  /** Hash of the JCS-canonical manifest body, for signing convenience. */
  manifest_hash: Sha256Hex;
}

/**
 *
 */
export function buildAnchorManifest(
  dayKey: string,
  entryHashes: ReadonlyArray<string>,
): AnchorManifest | null {
  const root = buildMerkleRoot(entryHashes);
  if (root === null) return null;
  // Manifest hash is over `${day}\n${root}\n${leaf_count}` — minimal, stable.
  const body = `${dayKey}\n${root}\n${entryHashes.length}`;
  return {
    day: dayKey,
    root,
    leaf_count: entryHashes.length,
    manifest_hash: sha256Hex(body),
  };
}
