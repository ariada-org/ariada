# Architecture — @ariada-org/diff-schema

This package implements the public-schema layer of the differential
accessibility CI gate. The runtime is intentionally minimal: pure
TypeScript, zero non-Node dependencies, deterministic output across
implementations.

## Modules

```
src/
  fingerprint.ts         — finding identity hash
  selector-normalise.ts  — DOM selector rules
  diff-result.ts         — DiffResult envelope + validator
  baseline-policy.ts     — declarative policy + first-match resolver
  gate-decision.ts       — deterministic decision builder
  sarif.ts               — SARIF 2.1.0 emitter
  exit-codes.ts          — stable CLI exit codes
  internal/
    jcs-encode.ts        — RFC 8785 JCS
    hash.ts              — SHA-256 via node:crypto
    glob-match.ts        — minimal glob matcher
  schemas/
    diff-result.schema.json
    baseline-policy.schema.json
    gate-decision.schema.json
```

## Determinism contract

Every public function is pure: same input always produces the same
output bytes. Tests under `tests/property/` enforce this via 1000+
randomised iterations.

The fingerprint pre-image is constructed from a fixed projection of the
Finding object, JCS-canonicalised, and hashed with SHA-256. Independent
re-implementations in other languages MUST produce byte-identical
output for byte-identical inputs.

## Why no Zod / Ajv runtime dependency

The package ships lightweight runtime validators (`validateDiffResult`,
`validateBaselinePolicy`, `validateGateDecision`) that return a
structured `{ valid, errors }` result. Downstream consumers that prefer
Zod or Ajv can layer them on top of the published JSON Schemas without
this package pulling those dependencies into the supply chain.
