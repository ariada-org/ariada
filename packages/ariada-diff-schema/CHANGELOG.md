# Changelog

All notable changes to `@ariada/diff-schema` are recorded in this file.
The format follows [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Dates are ISO 8601 (UTC).

## Unreleased

### Added

- Initial public surface of `@ariada/diff-schema` — the reference
  implementation of the differential accessibility CI gate schemas:
  - RFC 8785 JCS canonicalization (`canonicalize`) with zero runtime
    dependencies.
  - SHA-256 helpers wrapping Node `node:crypto` (`sha256Hex`,
    `sha256BytesHex`).
  - Selector normalisation rules (`normaliseSelector`).
  - Finding fingerprint construction (`computeFindingFingerprint`,
    `computeFingerprints`).
  - DiffResult envelope + lightweight runtime validator
    (`validateDiffResult`, `computeCounts`).
  - BaselinePolicy + first-match resolver (`defaultPolicy`,
    `resolvePolicy`, `validateBaselinePolicy`).
  - GateDecision builder + canonical hash (`buildGateDecision`,
    `gateDecisionHash`, `validateGateDecision`).
  - SARIF 2.1.0 emitter for new findings (`emitSarif`).
  - Stable CLI exit-code constants.
- JSON Schema 2020-12 documents for DiffResult, BaselinePolicy, and
  GateDecision under `src/schemas/`.
- Vitest unit, property, and integration tests covering fingerprint
  determinism, selector idempotence, diff symmetry, policy resolution,
  and schema round-trip.
- REUSE 3.3 compliance metadata under `REUSE.toml` + `LICENSES/`.
- `SECURITY.md` with private-vulnerability-reporting policy.
