# Changelog

All notable changes to `@ariada-org/haes` are recorded in this file. The
format follows [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Dates are ISO 8601 (UTC).

## Unreleased

### Added

- Initial public surface of `@ariada-org/haes` — the open-source reference
  implementation of the Hash-anchored Evidence Stream:
  - RFC 8785 JCS canonicalization (`canonicalize`)
  - SHA-256 and Ed25519 primitives (`sha256Hex`, `sha256Bytes`,
    `generateEd25519Keypair`, `signEd25519`, `verifyEd25519`)
  - Crockford-base32 ULID-style identifiers (`ulid`, `encodeTime`,
    `decodeUlidTimestamp`, `nowRfc3339`)
  - Attestation pipeline (`buildEntry`, `computeEntryHash`,
    `signEntryHash`, `AIAS_SCHEMA_VERSION`)
  - Verification pipeline (`verifyEntry`, `verifyChain`)
  - Merkle-anchor primitives (`buildMerkleRoot`, `buildInclusionProof`,
    `verifyInclusionProof`, `buildAnchorManifest`)
  - In-memory reference storage backend (`InMemoryStorage`) implementing
    the `HaesStorageBackend` interface
  - High-level `HaesClient` orchestrator
- Vitest unit tests covering canonicalization, crypto primitives,
  attestation, verification round-trips, Merkle commitments, identifiers,
  and end-to-end client flow.
- REUSE 3.3 compliance metadata under `REUSE.toml` + `LICENSES/`.
- `SECURITY.md` with private-vulnerability-reporting policy.
