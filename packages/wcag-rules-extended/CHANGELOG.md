<!-- SPDX-FileCopyrightText: 2025-2026 Agonist Development AB -->
<!-- SPDX-License-Identifier: CC-BY-SA-4.0 -->

# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added in this revision (2026-05-17) — Playwright cross-engine E2E

- **Playwright E2E suite** (`tests/e2e/`):
  - 45 cross-engine tests = 5 showcase rules × 3 fixture-scenarios × 3
    browsers (Chromium / Firefox / WebKit). Complements the 524 vitest
    unit tests that run in happy-dom synthetic DOM — proves rules fire
    identically under real browser layout / styling / scripting.
  - Covers 5 showcase rules across all 3 packs:
    - `ariada/checkout/payment-fieldset-grouping` (Pack A)
    - `ariada/checkout/autocomplete-personal-data` (Pack A)
    - `ariada/checkout/required-field-machine-readable` (Pack A)
    - `ariada/statement/enforcement-procedure-link` (Pack B)
    - `ariada/banking/lang-matches-locale` (Pack C)
  - In-process Node HTTP server fixture (`tests/e2e/fixtures/server.ts`)
    serves M7 EU real-world HTML from `@ariada-org/test-fixtures` per-worker
    on random localhost ports — fully deterministic, never reaches outside.
  - `analyzeWithEaa(page, ruleIds)` helper bundles the rule pack with
    esbuild and injects via `page.addScriptTag` — works around
    `@axe-core/playwright`'s missing `axe.configure({rules,checks})` hook.
  - New scripts: `pnpm test:e2e`, `pnpm test:e2e:ui`, `pnpm test:e2e:debug`.
  - HTML + JSON reporters → `playwright-report/` + `test-results.json`.
  - Full suite passes in ~20 s wall-clock on all 3 engines.
  - Docs: `docs/E2E_TESTING.md`.

### Added (2026-05-15) — statement generator + EU real-world fixtures

- **Accessibility-statement generator** (`src/statement/`):
  - `generateStatement(violations, meta, options)` — HTML or MDX output
  - Nordic 4 + English locales (en / sv / nb / da / fi)
  - Nordic jurisdictions (SE / NO / DK / FI) with national enforcement
    authority URLs (DIGG / Digdir / Digst / Avi)
  - Auto-derives conformance (full / partial / non-conformant) from violations
  - Statement structure follows Directive 2016/2102 art. 7 template
  - 37 new vitest tests including 20 locale × jurisdiction matrix tests
- **EU real-world test fixtures** (`test/fixtures/eu-real-world/`):
  - 16 fixtures across 5 pattern categories (Klarna-style / BankID-style /
    MobilePay-style / Finnish Avi-style / Mittelstand DE / French RGAA)
  - All CC0-1.0 — original synthetic content, no vendor markup copied
  - Mix of PASS / FAIL fixtures for integration testing
  - 18 smoke tests verifying provenance + lang attrs + README coverage

### Added (2026-05-15) — compliance-evidence emitters + penalty estimator

- **Compliance-evidence emitters** (`src/evidence/`):
  - `emitVpat(violations, meta)` — VPAT 2.5 JSON (US Section 508 / ITI)
  - `emitEn301549(violations, meta)` — EN 301 549 v3.2.1 §11 Conformance Statement
  - `emitDosLagen(violations, meta, options)` — Swedish DOS-lagen statement (DIGG)
  - Full WCAG 2.2 SC catalogue (87 criteria, all A/AA/AAA levels)
  - 21 new vitest tests covering all three emitters
- **EAA penalty exposure estimator** (`src/penalty/`):
  - `estimatePenalty(violations, jurisdiction, options)` — risk model
  - 11 jurisdiction profiles: SE / NO / DK / FI / DE / FR / NL / AT / CH / UK / EU
  - Per-jurisdiction statutory caps, base fines, sector / impact multipliers,
    empirical enforcement factors (calibrated from regulator reports 2022-2025)
  - DSA-style turnover scaling for EU-wide exposure modelling
  - 12 new vitest tests covering all jurisdictions + sensitivity scenarios

### Added in this revision (2026-05-14)

- **31 WCAG 2.2 AA rules across 3 EAA-aligned packs:**
  - Pack A — e-commerce checkout flow (EAA Annex I §I.3): 11 rules
  - Pack B — accessibility statement compliance (DOS-lagen / EN 301 549): 10 rules
  - Pack C — banking digital channels + Nordic locale (EAA Annex I §I.4): 10 rules
- **186 Vitest unit tests** covering FAIL + PASS + Nordic-locale fixtures
- TypeScript strict mode + ESM-only build (clean typecheck, clean build)
- `addEaaRules(axe)` + `eaaConfig()` public API in `src/index.ts`
- Per-rule axe-core-compatible `RuleDefinition` + `CheckDefinition` shape
- Multilingual error / help message patterns (en/sv/nb/da/fi) in regex matchers
- Shared helpers: `getAccessibleNameLite`, `isStatementPage`, `statementText`,
  Nordic distinctive-word language detection

## [0.1.0-pre] — 2026-05-14

### Added

- Project initialised as a separate public repository under
  `@ariada-org/wcag-rules-extended`, license EUPL-1.2.
- README, NOTICE, scaffolding files.
- Patent peace pledge and IP separation discipline documented.

### Notes

- This is a **pre-release** version. Not published to npm. Not tagged.
