// SPDX-License-Identifier: EUPL-1.2
import { describe, expect, it } from 'vitest';

import {
  buildAnchorManifest,
  buildInclusionProof,
  buildMerkleRoot,
  verifyInclusionProof,
} from '../src/anchor.js';
import { sha256Hex } from '../src/crypto.js';

function leafHashes(n: number): string[] {
  return Array.from({ length: n }, (_, i) => sha256Hex(`leaf-${i}`));
}

describe('Merkle root + inclusion proofs', () => {
  it('returns null root for an empty leaf set', () => {
    expect(buildMerkleRoot([])).toBeNull();
  });

  it('returns the leaf itself as the root for a single-leaf tree', () => {
    const [leaf] = leafHashes(1);
    expect(buildMerkleRoot([leaf as string])).toBe(leaf);
  });

  it('builds a deterministic root for a 2-leaf tree (H(l || r))', () => {
    const leaves = leafHashes(2);
    expect(buildMerkleRoot(leaves)).toMatch(/^[0-9a-f]{64}$/);
    // Same input → same root.
    expect(buildMerkleRoot(leaves)).toBe(buildMerkleRoot(leaves));
  });

  it('odd-leaf promotion: 3-leaf root is stable and reproducible', () => {
    const leaves = leafHashes(3);
    const r1 = buildMerkleRoot(leaves) as string;
    const r2 = buildMerkleRoot(leaves) as string;
    expect(r1).toBe(r2);
    expect(r1).toMatch(/^[0-9a-f]{64}$/);
  });

  it('proves inclusion for every leaf in a 7-leaf tree', () => {
    const leaves = leafHashes(7);
    const root = buildMerkleRoot(leaves) as string;
    for (let i = 0; i < leaves.length; i++) {
      const proof = buildInclusionProof(leaves, i);
      expect(proof.leaf).toBe(leaves[i]);
      expect(proof.root).toBe(root);
      expect(verifyInclusionProof(proof, root)).toBe(true);
    }
  });

  it('proves inclusion for a 16-leaf (power-of-two) tree', () => {
    const leaves = leafHashes(16);
    const root = buildMerkleRoot(leaves) as string;
    for (let i = 0; i < leaves.length; i++) {
      const proof = buildInclusionProof(leaves, i);
      expect(verifyInclusionProof(proof, root)).toBe(true);
    }
  });

  it('rejects a tampered inclusion proof (mutated sibling)', () => {
    const leaves = leafHashes(8);
    const root = buildMerkleRoot(leaves) as string;
    const proof = buildInclusionProof(leaves, 3);
    const bad = {
      ...proof,
      path: proof.path.map((s, idx) =>
        idx === 0 ? { ...s, sibling: sha256Hex('forged') } : s,
      ),
    };
    expect(verifyInclusionProof(bad, root)).toBe(false);
  });

  it('rejects an inclusion proof against a wrong root', () => {
    const leaves = leafHashes(8);
    const proof = buildInclusionProof(leaves, 0);
    expect(verifyInclusionProof(proof, sha256Hex('not-the-root'))).toBe(false);
  });

  it('throws on out-of-range leaf index', () => {
    const leaves = leafHashes(4);
    expect(() => buildInclusionProof(leaves, -1)).toThrow(RangeError);
    expect(() => buildInclusionProof(leaves, 4)).toThrow(RangeError);
    expect(() => buildInclusionProof([], 0)).toThrow(RangeError);
  });

  it('changes the root when even a single leaf hash is mutated', () => {
    const leaves = leafHashes(5);
    const root1 = buildMerkleRoot(leaves);
    const mutated = [...leaves];
    mutated[2] = sha256Hex('different-leaf');
    const root2 = buildMerkleRoot(mutated);
    expect(root1).not.toBe(root2);
  });

  it('buildAnchorManifest returns null for empty input, populated otherwise', () => {
    expect(buildAnchorManifest('2026-08-02', [])).toBeNull();
    const m = buildAnchorManifest('2026-08-02', leafHashes(4));
    expect(m).not.toBeNull();
    expect(m?.day).toBe('2026-08-02');
    expect(m?.leaf_count).toBe(4);
    expect(m?.root).toMatch(/^[0-9a-f]{64}$/);
    expect(m?.manifest_hash).toMatch(/^[0-9a-f]{64}$/);
  });
});
