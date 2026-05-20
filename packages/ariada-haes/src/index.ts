// SPDX-License-Identifier: EUPL-1.2
//
// `@ariada/haes` public entry point.
//
// Exports the canonical types + the four primitive surfaces of the
// Hash-anchored Evidence Stream (HAES):
//
//   1. Canonical encoding (RFC 8785 JCS) and cryptographic primitives
//      (SHA-256, Ed25519, ULID-style identifiers).
//   2. Attestation pipeline: `buildEntry`, `computeEntryHash`,
//      `signEntryHash`, and the schema-version constant.
//   3. Verification pipeline: `verifyEntry`, `verifyChain`.
//   4. Merkle-anchor primitives: `buildMerkleRoot`, `buildInclusionProof`,
//      `verifyInclusionProof`, `buildAnchorManifest`.
//
// Plus an in-memory reference storage backend and a high-level `HaesClient`
// that ties everything together for the common single-deployer flow.

export {
  AIAS_SCHEMA_VERSION,
  buildEntry,
  computeEntryHash,
  DEFAULT_SIGNATURE_ALGORITHM,
  GENESIS_PREV_HASH,
  signEntryHash,
} from './attest.js';

export {
  buildAnchorManifest,
  buildInclusionProof,
  buildMerkleRoot,
  rootOverEntryHashes,
  verifyInclusionProof,
  type AnchorManifest,
} from './anchor.js';

export { canonicalize } from './canonical.js';

export { HaesClient, type HaesClientOptions } from './client.js';

export {
  bytesToHex,
  exportEd25519PublicKeyRaw,
  generateEd25519Keypair,
  getRandomBytes,
  hexToBytes,
  importEd25519PublicKeyRaw,
  sha256Bytes,
  sha256Hex,
  signEd25519,
  verifyEd25519,
  type Ed25519Keypair,
} from './crypto.js';

export { decodeUlidTimestamp, encodeRandom, encodeTime, nowRfc3339, ulid } from './id.js';

export {
  InMemoryStorage,
  type HaesStorageBackend,
} from './storage.js';

export type {
  AppendInput,
  AppendResult,
  ArtifactDecision,
  EntryPayload,
  EntrySignature,
  HaesEntry,
  MerkleInclusionProof,
  MerkleProofStep,
  Sha256Hex,
  SignatureAlgorithm,
  VerificationResult,
} from './types.js';

export { verifyChain, verifyEntry } from './verify.js';
