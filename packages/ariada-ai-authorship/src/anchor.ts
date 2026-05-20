// SPDX-License-Identifier: EUPL-1.2
//
// Composition layer with `@ariada/haes` — implements the documented
// canonicalise + sign + append pattern:
//
//   1. Serialise the `AttributionPosterior` via RFC 8785 JCS canonicalisation
//      (re-using the `canonicalize` export from `@ariada/haes`).
//   2. SHA-256 the canonical bytes to produce an `output_checksum`.
//   3. Build a `HaesEntry` payload with `artifact_kind` recorded in the
//      `extensions` map as `ai-authorship-attribution`.
//   4. Append to a HAES chain via `HaesClient.append`. The client signs the
//      entry hash with the customer's Ed25519 keypair under the hood.
//   5. Return the appended entry plus the per-day Merkle inclusion proof
//      (when one is available on the supplied storage backend).
//
// The function is intentionally a thin orchestration over the shipped
// `@ariada/haes` exports. It carries no internal IP — every hashing,
// signature, and Merkle primitive lives in the sibling package.

import {
  buildInclusionProof,
  buildMerkleRoot,
  canonicalize,
  rootOverEntryHashes,
  sha256Hex,
  type AppendResult,
  type Ed25519Keypair,
  type EntryPayload,
  type HaesClient,
  type HaesEntry,
  type HaesStorageBackend,
  type MerkleInclusionProof,
} from '@ariada/haes';

import type {
  AIAgentId,
  AttributionPosterior,
} from './types.js';

/** Stable artifact-kind tag recorded in HAES entry extensions. */
export const ARTIFACT_KIND = 'ai-authorship-attribution' as const;

/** Stable model-id reported to HAES — identifies the ensemble surface. */
export const ANCHOR_MODEL_ID = 'ariada:ai-authorship-ensemble-v1' as const;

/** Options accepted by `anchorPosterior`. */
export interface AnchorPosteriorOptions {
  /** Live HAES client to append into. Supplies the signing key. */
  client: HaesClient;
  /** Optional override for the signing-key id recorded in the payload. */
  signing_key_id: string;
  /** Optional input redaction profile identifier. Defaults to `none`. */
  input_redaction_profile?: string;
  /** Optional prompt-template fingerprint. Defaults to the artifact-kind hash. */
  prompt_template_fingerprint?: string;
  /** Optional decision label. Defaults to `shipped`. */
  decision?: 'shipped' | 'rewritten' | 'blocked';
}

/** Result of an anchor operation. */
export interface AnchorPosteriorResult {
  entry: HaesEntry;
  output_checksum: string;
  artifact_kind: typeof ARTIFACT_KIND;
  top_agent: AIAgentId;
}

/**
 * Canonicalise an `AttributionPosterior` and compute its SHA-256 checksum
 * — used as the `output_checksum` field of the HAES payload. Exported so
 * downstream callers (e.g. transparency PDF renderers) can reproduce the
 * checksum independently.
 */
export function canonicalisePosterior(
  posterior: AttributionPosterior,
): { canonical: string; checksum: string } {
  const canonical = canonicalize(
    posterior as unknown as Record<string, unknown>,
  );
  const checksum = sha256Hex(canonical);
  return { canonical, checksum };
}

/**
 * Append an `AttributionPosterior` to a HAES chain. Implements the §7.5
 * composition pattern verbatim — canonicalise → checksum → buildEntry →
 * sign → append.
 */
export async function anchorPosterior(
  posterior: AttributionPosterior,
  options: AnchorPosteriorOptions,
): Promise<AnchorPosteriorResult> {
  const { checksum } = canonicalisePosterior(posterior);
  const top = posterior.posterior[0];
  if (top === undefined) {
    throw new Error('anchorPosterior: empty posterior array');
  }
  const payload: EntryPayload = {
    model_id: ANCHOR_MODEL_ID,
    model_version: posterior.classifier_version,
    prompt_template_fingerprint:
      options.prompt_template_fingerprint ?? sha256Hex(ARTIFACT_KIND),
    input_redaction_profile: options.input_redaction_profile ?? 'none',
    output_checksum: checksum,
    decision: options.decision ?? 'shipped',
    signing_key_id: options.signing_key_id,
    extensions: {
      artifact_kind: ARTIFACT_KIND,
      calibration_version: posterior.calibration_version,
      inference_mode: posterior.inference_mode,
      confidence: posterior.confidence,
      top_agent: top.agent,
    },
  };
  const result: AppendResult = await options.client.append({ payload });
  return {
    entry: result.entry,
    output_checksum: checksum,
    artifact_kind: ARTIFACT_KIND,
    top_agent: top.agent,
  };
}

/**
 * Convenience helper — given a set of HAES entries, build a Merkle root + a
 * single inclusion proof for the entry whose `entry_hash === target_hash`.
 * Re-exports the primitives from `@ariada/haes` for callers that don't want
 * to import them directly.
 *
 * Throws if `target_hash` is not present in the entries list.
 */
export function buildAnchorInclusionProof(
  entries: HaesEntry[],
  target_hash: string,
): { root: string | null; proof: MerkleInclusionProof } {
  const hashes = entries.map((e) => e.entry_hash);
  const idx = hashes.indexOf(target_hash);
  if (idx < 0) {
    throw new RangeError(
      `buildAnchorInclusionProof: target_hash not present in entries`,
    );
  }
  const root = rootOverEntryHashes(hashes);
  const proof = buildInclusionProof(hashes, idx);
  return { root, proof };
}

// Re-export `buildMerkleRoot` and storage-backend type so consumers don't
// need to import `@ariada/haes` directly in simple cases.
export { buildMerkleRoot };
export type { Ed25519Keypair, HaesStorageBackend };
