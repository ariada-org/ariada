// SPDX-License-Identifier: EUPL-1.2
//
// AC-5 — Module H anchoring integration test. Exercises the §7.5 composition
// pattern against the shipped `@ariada-org/haes` exports.
//
//   1. Produce an AttributionPosterior in offline mode.
//   2. anchorPosterior canonicalises (RFC 8785 JCS) + builds entry + signs
//      (Ed25519) + appends to a HAES chain.
//   3. Build a daily Merkle root over the chain's entry hashes.
//   4. Build an inclusion proof for the anchored entry.
//   5. verifyInclusionProof returns true against the same root.

import {
  GENESIS_PREV_HASH,
  HaesClient,
  computeEntryHash,
  generateEd25519Keypair,
  hexToBytes,
  rootOverEntryHashes,
  verifyEd25519,
  verifyInclusionProof,
} from '@ariada-org/haes';
import { describe, it, expect } from 'vitest';

import {
  anchorPosterior,
  attributeOffline,
  buildAnchorInclusionProof,
  canonicalisePosterior,
  ARTIFACT_KIND,
} from '../../src/index.js';
import { sampleInput } from '../helpers.js';

describe('Module H anchoring composition (AC-5)', () => {
  it('end-to-end anchor + verify inclusion proof', async () => {
    const result = attributeOffline(sampleInput());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const keypair = generateEd25519Keypair();
    const client = new HaesClient({ signingKey: keypair });
    const anchored = await anchorPosterior(result.value, {
      client,
      signing_key_id: keypair.keyId,
    });
    expect(anchored.artifact_kind).toBe(ARTIFACT_KIND);
    expect(anchored.entry.payload.signing_key_id).toBe(keypair.keyId);
    // The output checksum equals the SHA-256 of the canonical posterior.
    const { checksum } = canonicalisePosterior(result.value);
    expect(anchored.output_checksum).toBe(checksum);
    expect(anchored.entry.payload.output_checksum).toBe(checksum);
    // Hand-verify: the canonical hash matches and the Ed25519 signature is valid.
    const recomputedHash = computeEntryHash({
      entry_id: anchored.entry.entry_id,
      timestamp: anchored.entry.timestamp,
      prev_hash: anchored.entry.prev_hash,
      payload: anchored.entry.payload,
      schema_version: anchored.entry.schema_version,
      ...(anchored.entry.tenant_id !== undefined
        ? { tenant_id: anchored.entry.tenant_id }
        : {}),
    });
    expect(recomputedHash).toBe(anchored.entry.entry_hash);
    expect(anchored.entry.prev_hash).toBe(GENESIS_PREV_HASH);
    const sigValid = verifyEd25519(
      keypair.publicKey,
      hexToBytes(anchored.entry.entry_hash),
      hexToBytes(anchored.entry.signature.value),
    );
    expect(sigValid).toBe(true);
    // Build a Merkle root over the chain + inclusion proof for the anchored entry.
    const allEntries = await client.snapshot();
    const root = rootOverEntryHashes(allEntries.map((e) => e.entry_hash));
    expect(root).not.toBeNull();
    const { proof, root: proofRoot } = buildAnchorInclusionProof(
      allEntries,
      anchored.entry.entry_hash,
    );
    expect(proofRoot).toBe(root);
    expect(verifyInclusionProof(proof, root!)).toBe(true);
  });

  it('anchors a batch of attributions and proves inclusion of each', async () => {
    const keypair = generateEd25519Keypair();
    const client = new HaesClient({ signingKey: keypair });
    const targets: string[] = [];
    for (let i = 0; i < 4; i += 1) {
      const result = attributeOffline(sampleInput({ code: `// hunk ${i}\nx${i}` }));
      expect(result.ok).toBe(true);
      if (!result.ok) continue;
      const anchored = await anchorPosterior(result.value, {
        client,
        signing_key_id: keypair.keyId,
      });
      targets.push(anchored.entry.entry_hash);
    }
    const entries = await client.snapshot();
    const root = rootOverEntryHashes(entries.map((e) => e.entry_hash));
    expect(root).not.toBeNull();
    for (const target of targets) {
      const { proof } = buildAnchorInclusionProof(entries, target);
      expect(verifyInclusionProof(proof, root!)).toBe(true);
    }
  });
});
