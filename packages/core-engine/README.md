<!-- SPDX-FileCopyrightText: 2025-2026 Agonist Development AB -->
<!-- SPDX-License-Identifier: CC-BY-SA-4.0 -->

# @ariada-org/core-engine

Pure-runtime engine for an accessibility scanner — analyzer fan-out, scoring, fingerprinting, schema validation. No Node, browser, or Playwright dependencies.

[![License: EUPL-1.2](https://img.shields.io/badge/license-EUPL--1.2-blue)](LICENSE)
[![CI](https://github.com/ariada-org/ariada/actions/workflows/ci.yml/badge.svg)](https://github.com/ariada-org/ariada/actions/workflows/ci.yml)
[![REUSE compliant](https://img.shields.io/badge/REUSE-3.3%20compliant-brightgreen)](https://reuse.software/)

## Quick-start

```bash
npm install @ariada-org/core-engine
```

```ts
import {
  runOrchestration,
  getDefaultRegistry,
  createNullLogger,
} from "@ariada-org/core-engine";

const report = await runOrchestration({
  snapshot, // produced by an adapter (Playwright, browser, etc.)
  registry: getDefaultRegistry(),
  logger: createNullLogger(),
});
console.log(report.stats);
```

Runtime: ECMAScript 2022, ES Modules, Node ≥ 22. Only runtime dependency is `zod` for schema validation.

## What this package does

The engine orchestrates an analyzer fan-out over a `UnifiedSnapshot` produced by an adapter. Analyzers each consume the snapshot and return `Finding[]`; the engine aggregates findings, computes a stable per-finding fingerprint, applies scoring + banding, and emits a typed `ScanEvent` stream. Cross-domain conflict detection identifies findings that contradict each other across analyzer domains.

Splitting the engine from any specific I/O runtime lets the same orchestration code run inside a Node CLI / CI gate, a Chrome extension on the live DOM, a Cloudflare Worker consuming pre-captured snapshots, or any other adapter that can produce a `UnifiedSnapshot`. Adapters do the I/O (launch a browser, read the DOM, capture network metadata); the engine does the pure logic.

Every public boundary type is described by a versioned [zod](https://zod.dev/) schema (`findingSchema`, `unifiedSnapshotSchema`, `analyzerMetadataSchema`, `scanEventSchema`). A parallel `*SchemaVersion` literal pins the version so downstream consumers (queues, SSE streams, IPC) can route on schema version.

## What this package does NOT do

It does not launch a browser, fetch a page, parse HTML, or evaluate WCAG rules itself. The bundled `color-contrast` analyzer exists as a worked example of the analyzer contract (WCAG 2.2 SC 1.4.3) — production WCAG rule sets are shipped separately by [`@ariada-org/wcag-rules-extended`](../wcag-rules-extended). The engine has no opinion on transport (file, queue, SSE, HTTP), output format, or persistence.

## API summary

| Export                                                                                          | Signature                                                          | Use                                                      |
| ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | -------------------------------------------------------- |
| `runOrchestration(opts)`                                                                        | `(opts: { snapshot, registry, logger }) => Promise<UnifiedReport>` | Fan-out analyzers, aggregate findings, return a report   |
| `createRegistry()` / `registerAnalyzer()` / `getDefaultRegistry()`                              | Registry helpers                                                   | Build or share an analyzer registry                      |
| `createEventEmitter()`                                                                          | `() => ScanEventEmitter`                                           | Emit a typed `ScanEvent` stream                          |
| `scoreFromCounts(counts)` / `bandFromScore(score)`                                              | scoring helpers                                                    | Severity-weighted score and band                         |
| `fingerprint(finding)` / `fingerprintAsync(finding)`                                            | `(f: Finding) => string`                                           | Stable per-finding fingerprint (de-duplication, diff)    |
| `createCrossDomainDetector()`                                                                   | `() => CrossDomainDetector`                                        | Detect findings that contradict across domains           |
| `runElementIteration(snapshot, fn)`                                                             | bbox-based element traversal                                       | Iterate snapshot elements with bounding boxes            |
| `validateAnalyzerResult` / `validateSnapshot` / `validateScanReportInput` / `validateVpatInput` | throwing parse helpers                                             | Parse `unknown` payloads at IPC / queue / SSE boundaries |
| `findingSchema`, `unifiedSnapshotSchema`, `scanEventSchema`, …                                  | zod schemas                                                        | Schema sources for code-gen + boundary validation        |
| `SCHEMAS_BASE`, `FINDING_SCHEMA_VERSION`, …                                                     | constants                                                          | Schema URI base + per-schema version literals            |

```ts
// Boundary validation example
import { validateAnalyzerResult } from "@ariada-org/core-engine";
try {
  const finding = validateAnalyzerResult(rawMessage);
  // finding is typed `Finding` here
} catch (err) {
  // err is ZodError — log + drop the payload
}
```

## Regulatory mapping

The engine is regulation-agnostic. The bundled `color-contrast` analyzer applies the WCAG 2.2 SC 1.4.3 (Contrast — Minimum) ratio test (4.5:1 / 3:1 large-text). Regulatory mapping for production rule sets lives in [`@ariada-org/wcag-rules-extended`](../wcag-rules-extended) (WCAG 2.2 AA, EN 301 549 v3.2.1, EAA Annex I, Directive 2016/2102 art. 7).

## Tests + verification

122 tests across 14 files (vitest), including 6 fuzz tests via fast-check (`pnpm test:fuzz`). Run with `pnpm test`; type-check via `pnpm typecheck`.

## Sibling packages

- [`@ariada-org/wcag-rules-extended`](../wcag-rules-extended) — production WCAG 2.2 AA rule packs (axe-core extension)
- [`@ariada-org/evidence-emitter`](../ariada-evidence-emitter) — VPAT / EN 301 549 / DOS-lagen JSON from violations
- [`@ariada-org/core-playwright`](../core-playwright) — Playwright adapter that produces `UnifiedSnapshot` inputs

## License

EUPL-1.2 — see [LICENSE](LICENSE). REUSE 3.3 compliant (per-file SPDX headers + `REUSE.toml`).
