# @ariada-org/diff-schema

Schemas and reference algorithms for the differential accessibility CI
gate. Defines the canonical fingerprint, selector normalisation, diff
envelope, baseline policy, and gate-decision contracts that any CI
runner can consume to surface new-vs-pre-existing accessibility
findings on a pull request.

Open source under [EUPL-1.2](./LICENSE). Zero runtime dependencies.
Node 22 LTS or newer.

## What this package does

Two accessibility scans of the same web surface — one against the
head commit, one against the base — produce overlapping sets of
findings. This package gives you the primitives to:

1. Hash each finding into a deterministic 64-character fingerprint
   that survives DOM volatility (auto-generated IDs, framework class
   hashes, nth-child reordering).
2. Classify the head set against the base set as `new`,
   `pre_existing`, or `resolved`.
3. Resolve a declarative policy file into a single
   pass / fail / warn gate decision.
4. Emit SARIF 2.1.0 for GitHub Code Scanning and GitLab SAST
   consumers.

The package ships the schemas + reference algorithms only. The
production diff engine is shipped separately.

## Install

```bash
npm install @ariada-org/diff-schema
```

## Usage

```ts
import {
  computeFindingFingerprint,
  defaultPolicy,
  buildGateDecision,
  emitSarif,
  validateDiffResult,
} from '@ariada-org/diff-schema';

const finding = {
  ruleId: 'wcag2/1.1.1',
  jurisdictionTags: ['WCAG2.2-AA', 'EAA'],
  severity: 'serious' as const,
  selector: 'main > img.hero',
  axTreeRole: 'img',
  axTreeName: 'Marketing hero image',
};

const fp = computeFindingFingerprint(finding);
// → 64-char lowercase hex (SHA-256 of the JCS-canonicalised pre-image)

const policy = defaultPolicy();
// → sensible defaults: new critical/serious fail, moderate/minor warn
```

## API

| Export                       | Type     | Description                                          |
|------------------------------|----------|------------------------------------------------------|
| `computeFindingFingerprint`  | function | Hash a finding into the canonical fingerprint.       |
| `normaliseSelector`          | function | Apply the deterministic DOM-selector rules.          |
| `validateDiffResult`         | function | Lightweight runtime validation of a DiffResult.      |
| `defaultPolicy`              | function | Built-in default `BaselinePolicy`.                   |
| `resolvePolicy`              | function | Resolve a finding context against a policy.          |
| `buildGateDecision`          | function | Deterministic GateDecision from DiffResult + policy. |
| `gateDecisionHash`           | function | SHA-256 of the canonical decision JSON.              |
| `emitSarif`                  | function | SARIF 2.1.0 emitter (new findings only).             |
| `EXIT_*` codes               | constant | Stable CLI exit codes.                               |
| `canonicalize`               | function | RFC 8785 JSON canonicalization (JCS).                |

## Standards referenced

- [RFC 8785 — JSON Canonicalization Scheme (JCS)](https://www.rfc-editor.org/rfc/rfc8785)
- [FIPS 180-4 — SHA-256](https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.180-4.pdf)
- [SARIF 2.1.0 — OASIS Static Analysis Results Interchange Format](https://docs.oasis-open.org/sarif/sarif/v2.1.0/sarif-v2.1.0.html)
- [WCAG 2.2 — Web Content Accessibility Guidelines](https://www.w3.org/TR/WCAG22/)

## License

EUPL-1.2 for code; CC-BY-SA-4.0 for prose; CC0-1.0 for build config.
See [LICENSE](./LICENSE) and [NOTICE](./NOTICE).
