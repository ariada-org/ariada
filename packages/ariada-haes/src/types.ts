// SPDX-License-Identifier: EUPL-1.2
//
// Canonical type definitions for the Hash-anchored Evidence Stream (HAES)
// reference client. Mirrors the AIAS (AI Artifact Inspection Standard) JSON
// shape so that TypeScript consumers get static type safety on the same
// canonical structure verified by cross-language verifiers.

/**
 * Decision recorded by the deployer on the AI artifact:
 *  - `shipped`    — output sent to end user as-is
 *  - `rewritten`  — output edited before shipping (parent_entry_id should
 *                   link to the pre-edit entry)
 *  - `blocked`    — output suppressed by a policy gate
 */
export type ArtifactDecision = 'shipped' | 'rewritten' | 'blocked';

/**
 * Signature-algorithm identifier. Currently only Ed25519; the schema
 * reserves room for hybrid post-quantum schemes (e.g. `Ed25519+Dilithium`)
 * without a breaking change.
 */
export type SignatureAlgorithm = 'Ed25519';

/**
 * The AI-artifact metadata block embedded in every entry. Fields marked
 * optional are absent from the canonical hash pre-image when not present.
 *
 * NOTE: `tags` is intentionally excluded from the canonical pre-image
 * (privacy + churn isolation — tag mutations do not break the chain).
 */
export interface EntryPayload {
  /** Stable model identifier, e.g. `openai:gpt-4o-2024-08-06`. */
  model_id: string;
  /** Provider-published version pin (weight checksum / snapshot id). */
  model_version: string;
  /** SHA-256 hex of the prompt-template shape (variable values excluded). */
  prompt_template_fingerprint: string;
  /** Redaction profile identifier (e.g. `pii-strict-v2`). */
  input_redaction_profile: string;
  /** SHA-256 hex of the model's output as delivered to consumer. */
  output_checksum: string;
  /** Deployer's action on the artifact. */
  decision: ArtifactDecision;
  /** SHA-256 hex fingerprint of the Ed25519 public key used to sign. */
  signing_key_id: string;
  /** When `decision='rewritten'`, prior entry whose output was rewritten. */
  parent_entry_id?: string;
  /** Free-form deployer metadata. NOT in canonical hash pre-image. */
  tags?: Record<string, string>;
  /** Schema-extension fields per AIAS extension registry. */
  extensions?: Record<string, unknown>;
}

/**
 * Signature block. `value` is Ed25519 signature (hex) over the raw 32-byte
 * SHA-256 entry hash bytes (not the hex string).
 */
export interface EntrySignature {
  algorithm: SignatureAlgorithm;
  value: string;
  public_key_url?: string;
}

/**
 * One ledger entry. `entry_hash` is computed over the canonical encoding of
 * all OTHER fields excluding `signature` and `payload.tags`. `signature` is
 * computed over the raw 32-byte hash AFTER the hash has been computed.
 */
export interface HaesEntry {
  entry_id: string;
  timestamp: string;
  prev_hash: string;
  entry_hash: string;
  payload: EntryPayload;
  signature: EntrySignature;
  schema_version: string;
  tenant_id?: string;
}

/**
 * The pre-hash shape — everything an `append` call provides plus a placeholder
 * for fields that the chain assigns (`entry_id`, `timestamp`, `prev_hash`).
 */
export interface AppendInput {
  payload: EntryPayload;
  /** Optional override for testing; default = Date.now() in UTC RFC 3339. */
  timestamp?: string;
  /** Optional override for testing; default = ULID-like id from timestamp. */
  entry_id?: string;
  schema_version?: string;
  tenant_id?: string;
}

/**
 * Outcome of an `append` call — the persisted entry plus the previous-entry
 * hash that was linked into it (for caller-side reconciliation).
 */
export interface AppendResult {
  entry: HaesEntry;
}

/**
 * Hex-encoded raw 32-byte SHA-256 (64 lowercase chars).
 */
export type Sha256Hex = string;

/**
 * One Merkle-proof step on the path from a leaf to the root.
 * `direction = 'L'` means the sibling hash is on the left of the current
 * node (i.e. the current node is the right child). `'R'` is the reverse.
 */
export interface MerkleProofStep {
  sibling: Sha256Hex;
  direction: 'L' | 'R';
}

/**
 *
 */
export interface MerkleInclusionProof {
  /** Leaf hash being proven (= an entry's `entry_hash`). */
  leaf: Sha256Hex;
  /** Sibling-hash chain from leaf level up to root. */
  path: ReadonlyArray<MerkleProofStep>;
  /** Computed root the path resolves to. */
  root: Sha256Hex;
}

/**
 * Verification verdict for one or many entries. `valid=true` means the chain
 * link, signature, and (if requested) Merkle proof all pass. On failure,
 * `reason` explains the first problem encountered.
 */
export interface VerificationResult {
  valid: boolean;
  reason?: string;
  failed_entry_id?: string;
}
