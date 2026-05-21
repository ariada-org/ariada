<!-- SPDX-FileCopyrightText: 2025-2026 Agonist Development AB -->
<!-- SPDX-License-Identifier: CC-BY-SA-4.0 -->

# @ariada/wcag-rules-extended

EAA 2025-aligned WCAG 2.2 AA rule packs that extend axe-core with EU-specific checks.

[![License: EUPL-1.2](https://img.shields.io/badge/license-EUPL--1.2-blue)](LICENSE)
[![CI](https://github.com/ariada-org/ariada/actions/workflows/ci.yml/badge.svg)](https://github.com/ariada-org/ariada/actions/workflows/ci.yml)
[![REUSE compliant](https://img.shields.io/badge/REUSE-3.3%20compliant-brightgreen)](https://reuse.software/)

## Quick-start

```bash
npm install --save-dev @ariada/wcag-rules-extended axe-core
```

```ts
import axe from "axe-core";
import { addEaaRules } from "@ariada/wcag-rules-extended";

addEaaRules(axe); // register 31 EAA-aligned rules
const results = await axe.run(); // standard axe-core API
```

`axe-core` is a peer dependency (not bundled). Node ≥ 22.

## What this package does

The European Accessibility Act (EAA — Directive (EU) 2019/882, enforceable since 28 June 2025) requires WCAG 2.2 AA conformance plus sector-specific obligations for e-commerce checkout, banking, and accessibility-statement publication. The upstream [axe-core](https://github.com/dequelabs/axe-core) ruleset covers WCAG 2.2 AA generically; it does not implement EAA Annex I sector checks or Nordic-locale national-transposition requirements.

This package adds three rule packs that close that gap. Each rule cites its WCAG 2.2 Success Criterion (SC), the corresponding EN 301 549 v3.2.1 clause, and the EAA Annex I § it implements. Rules are registered through the documented `axe.configure({ rules, checks })` API — no axe-core source modification, no monkey-patching.

The package also re-exports three sibling helpers (`emitVpat`, `generateStatement`, `estimatePenalty`) so a single scanner run can produce VPAT 2.5 JSON, an EN 301 549 §11 conformance report, a Nordic accessibility-statement HTML file, and a per-jurisdiction penalty exposure estimate.

## What this package does NOT do

It does not run a browser, host a scanner, or talk to any external service. It exposes rule and check definitions plus a small `addEaaRules(axe)` helper. The caller drives axe-core in whatever environment they already use (CI, Playwright, Puppeteer, `@axe-core/cli`, a browser extension). It does not attempt to grade conformance for non-Nordic jurisdictions beyond the EU-level Directive baseline.

## API summary

| Export                                     | Signature                                    | Use                                                              |
| ------------------------------------------ | -------------------------------------------- | ---------------------------------------------------------------- |
| `addEaaRules(axe)`                         | `(axe: AxeLikeConfigurable) => void`         | Register all 31 rules + checks on a given axe instance           |
| `eaaConfig()`                              | `() => { rules, checks }`                    | Return a config object for manual `axe.configure(...)`           |
| `ecommerceCheckoutRules` / `Checks`        | `RuleDefinition[]` / `CheckDefinition[]`     | Pack A — 11 rules, EAA Annex I §I.3                              |
| `statementRules` / `Checks`                | `RuleDefinition[]` / `CheckDefinition[]`     | Pack B — 10 rules, EAA Annex I §I.1 + Directive 2016/2102 art. 7 |
| `bankingRules` / `Checks`                  | `RuleDefinition[]` / `CheckDefinition[]`     | Pack C — 10 rules, EAA Annex I §I.4 + Nordic-locale patterns     |
| `allRules` / `allChecks`                   | `RuleDefinition[]` / `CheckDefinition[]`     | Aggregate across all three packs                                 |
| `emitVpat`, `emitEn301549`, `emitDosLagen` | re-export from `@ariada/evidence-emitter`    | Generate compliance artefacts from violations                    |
| `generateStatement`                        | re-export from `@ariada/statement-generator` | Render an accessibility-statement HTML/MDX file                  |
| `estimatePenalty`, `listJurisdictions`     | re-export from `@ariada/penalty-estimator`   | Per-jurisdiction fine exposure estimate                          |

Full rule catalogue with per-rule SC + clause + § mapping: [`docs/rules/INDEX.md`](docs/rules/INDEX.md). Methodology in [`docs/METHODOLOGY.md`](docs/METHODOLOGY.md).

## Regulatory mapping

- WCAG 2.2 AA — implements SC 1.3.1, 1.4.3, 2.4.6, 3.3.2, 3.3.4, 3.3.7, 4.1.2, 4.1.3 (full list per rule in `docs/rules/INDEX.md`)
- EN 301 549 v3.2.1 — §6.5.1 (numeric input), §9.1.3.5 (identify input purpose), §9.3.3.4 (error prevention), §11.7 (user preferences)
- Directive (EU) 2019/882 (EAA) Annex I — §I.1 statement, §I.3 e-commerce checkout, §I.4 banking
- Directive (EU) 2016/2102 art. 7 — accessibility-statement template for public-sector bodies
- National transpositions — Lag (2018:1937) DOS-lagen (SE), forskrift om universell utforming (NO), webtilgængelighed-bekendtgørelsen (DK), saavutettavuuslaki (FI)

## Tests + verification

693 tests across 38 files (vitest, including 3 property-based suites via fast-check), plus an axe-core integration suite and an EU real-world fixture suite. Run with `pnpm test`; coverage via `pnpm test:coverage`; mutation testing via `pnpm test:mutation` (Stryker).

## Sibling packages

- [`@ariada/core-engine`](../core-engine) — runtime-agnostic scanner engine
- [`@ariada/evidence-emitter`](../ariada-evidence-emitter) — VPAT / EN 301 549 / DOS-lagen JSON emitters
- [`@ariada/statement-generator`](../ariada-statement-generator) — EN 301 549 §7 accessibility-statement HTML/MDX

## License

EUPL-1.2 — see [LICENSE](LICENSE). axe-core (MPL-2.0) attribution in [NOTICE](NOTICE).
