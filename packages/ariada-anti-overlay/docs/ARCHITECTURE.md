<!--
SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
SPDX-License-Identifier: CC-BY-SA-4.0
-->

# Architecture

## Modules

```
src/
  index.ts              public API surface
  detect.ts             orchestrator
  report.ts             OverlayReport formatter
  confidence.ts         per-vendor confidence-band rubric
  citations.ts          W3C-WAI + OverlayFactsheet constants and disclaimer
  types.ts              public + internal type surface
  signatures/
    index.ts            frozen registry aggregator
    accessibe.ts        per-vendor signature modules…
    userway.ts
    equalweb.ts
    audioeye.ts
    reciteme.ts
    maxaccess.ts
    accessibe-iframe.ts (confidence capped at medium)
    faciliti.ts
    purple-lens.ts
    generic-toolbar.ts  (catch-all, confidence locked at low)
```

## Data flow

1. Caller invokes `detectOverlays({ html } | { url }, options?)`.
2. The orchestrator resolves the HTML — directly for `html` input, or by delegating to `options.fetcher` for `url` input.
3. Each vendor signature in the registry runs against the HTML; matched signature kinds are aggregated per vendor.
4. The confidence rubric assigns a band per vendor; per-vendor confidence caps are applied; the floor filter (`options.confidenceFloor`) excludes hits below the floor.
5. The report formatter wraps the hits, attaches the citations block, stamps `scannedAt` (clock injectable for deterministic tests), and stamps the `signaturesVersion` pin.

## Invariants

- No outbound network from the package itself. Verified by `tests/unit/no-network.test.ts`.
- Deterministic output under fixed clock. Verified by orchestrator tests.
- Citations block always present even when zero vendors detected.
- Every regex is host-anchored / word-bounded so that vendor-name occurrences in operational email aliases or in the citation strings themselves do not match.
- Every regex is linear-time-verifiable; no nested unbounded quantifiers.

## Signature lifecycle

Each `VendorSignature` carries `firstSeen` and `lastVerified` ISO dates. The intended cadence is a quarterly manual review by the maintainer, with the new `lastVerified` date landing as a semver-patch bump. Adding a new vendor is a semver-minor bump; changing the public `OverlayReport` schema is a semver-major bump.
