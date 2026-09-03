<!-- SPDX-FileCopyrightText: 2025-2026 Agonist Development AB -->
<!-- SPDX-License-Identifier: CC-BY-SA-4.0 -->
# @ariada-org/evidence-emitter

Pure-function emitters that turn a normalized list of accessibility violations into machine-readable compliance evidence — VPAT 2.5, EN 301 549 §11, Swedish DOS-lagen.

[![License: EUPL-1.2](https://img.shields.io/badge/license-EUPL--1.2-blue)](LICENSE)
[![CI](https://github.com/ariada-org/ariada/actions/workflows/ci.yml/badge.svg)](https://github.com/ariada-org/ariada/actions/workflows/ci.yml)

## Quick-start

```bash
npm install @ariada-org/evidence-emitter
```

```ts
import { emitVpat, emitEn301549, emitDosLagen } from '@ariada-org/evidence-emitter';
import type { Violation, ReportMeta } from '@ariada-org/evidence-emitter';

const violations: Violation[] = [/* axe-core results normalized */];
const meta: ReportMeta = {
  productName: 'Example Web App',
  productVersion: '2.5.0',
  evaluator: 'Audit Team',
  evaluationDate: '2026-05-16',
  scope: 'https://example.com/checkout',
};

const vpat = emitVpat(violations, meta);
const en301549 = emitEn301549(violations, meta);
```

Node ≥ 22. No runtime dependencies, no network, no DOM mutation.

## What this package does

Three deterministic functions take a `Violation[]` plus `ReportMeta` and return JSON-serialisable report objects in the three formats most often demanded by EU + US procurement, regulator notifications, and `.well-known/` publication:

- **VPAT 2.5** (`emitVpat`) — US Section 508 / ITI Voluntary Product Accessibility Template, structured by WCAG 2.2 Success Criterion with per-criterion conformance level.
- **EN 301 549 v3.2.1 §11** (`emitEn301549`) — ETSI harmonised standard conformance report covering WCAG-mapped clauses §11.1–§11.8.
- **Swedish DOS-lagen** (`emitDosLagen`) — Lag (2018:1937) accessibility-statement structure aligned with DIGG (Myndigheten för digital förvaltning) guidelines.

Every emitter is a pure function: same input → same output, no side effects. Each result carries a pinned `$schema` URI and `schemaVersion` literal so downstream consumers (queues, dashboards, regulator-portal uploads) can route on version. All three formats consume the same `Violation` shape, so a single scanner run can produce all three artefacts without re-aggregation.

## What this package does NOT do

It does not scan, render HTML, render PDF, sign reports, post to regulator portals, or generate accessibility-statement landing pages. The output is JSON only — see [`@ariada-org/statement-generator`](../ariada-statement-generator) for the EN 301 549 §7 HTML / MDX accessibility-statement renderer, and [`@ariada-org/vpat-html-renderer`](../ariada-vpat-html-renderer) for the VPAT HTML view.

## API summary

| Export | Signature | Returns |
|---|---|---|
| `emitVpat(violations, meta)` | `(Violation[], ReportMeta) => VpatReport` | VPAT 2.5 JSON — per-SC conformance rows |
| `emitEn301549(violations, meta)` | `(Violation[], ReportMeta) => En301549Report` | EN 301 549 §11 conformance table |
| `emitDosLagen(violations, meta, opts)` | `(Violation[], ReportMeta, DosLagenOptions) => DosLagenReport` | Swedish DOS-lagen statement object (Swedish-language fields) |
| `WCAG_22_CRITERIA` | `readonly WcagCriterion[]` | Catalogue of all WCAG 2.2 Success Criteria (number, level, title) |
| `WCAG_BY_SC` | `Record<string, WcagCriterion>` | SC-number lookup table |

Types: `Violation`, `ReportMeta`, `VpatReport`, `VpatCriterion`, `VpatConformanceLevel`, `En301549Report`, `En301549Row`, `En301549Status`, `DosLagenReport`, `DosLagenStatus`, `DosLagenOptions`.

## Regulatory mapping

- **VPAT 2.5** — [ITI specification](https://www.itic.org/policy/accessibility/vpat); structured per WCAG 2.2 Success Criteria + US Revised Section 508 (36 CFR Part 1194)
- **EN 301 549 v3.2.1** — [ETSI harmonised standard](https://www.etsi.org/deliver/etsi_en/301500_301599/301549/03.02.01_60/en_301549v030201p.pdf); §11.1–§11.8 cover WCAG 2.1 AA web mapping (extended here to WCAG 2.2 AA)
- **DOS-lagen** — Lag (2018:1937) om tillgänglighet till digital offentlig service; statement structure per [DIGG guidelines](https://www.digg.se/digital-tillganglighet)
- Companion to Directive (EU) 2019/882 (EAA) Annex I §I.1 statement obligations and Directive (EU) 2016/2102 art. 7

## Tests + verification

67 tests across 4 files (vitest), including 3 property-based suites via fast-check that verify structural invariants (schema URI stability, summary totals, per-SC cardinality). Run with `pnpm test`; coverage via `pnpm test:coverage`.

## Sibling packages

- [`@ariada-org/wcag-rules-extended`](../wcag-rules-extended) — produces the violations these emitters consume
- [`@ariada-org/statement-generator`](../ariada-statement-generator) — renders accessibility-statement HTML/MDX from the same `Violation` + `ReportMeta`
- [`@ariada-org/vpat-html-renderer`](../ariada-vpat-html-renderer) — renders VPAT HTML from `emitVpat` output

## License

EUPL-1.2 — see [LICENSE](LICENSE).

## Test coverage

Measured coverage for this package, alongside every other one in the
repository, is on [one generated page](../../apps/ariada-org/public/modules/test-coverage/index.html). It is rebuilt by
`bash scripts/sobrat-pokrytie.sh`, which runs each package's own coverage
task and records what it reports — including the packages that could not
report, and why.
