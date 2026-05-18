<!-- SPDX-FileCopyrightText: 2025-2026 Agonist Development AB -->
<!-- SPDX-License-Identifier: CC-BY-SA-4.0 -->

# Changelog

All notable changes to the `ariada-org/ariada` monorepo are documented in this
file. Per-package changelogs (with finer-grained entries) live alongside each
package under `packages/<name>/CHANGELOG.md`; this root file aggregates the
cross-cutting milestones a downstream consumer or auditor cares about.

The format follows [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/)
and the repository adheres to [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html).

Sections per release: `Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`,
`Security`. Dates are ISO-8601 (UTC). Each entry refers to the
monorepo as a whole; package-level granularity stays in the per-package
changelog.

## [Unreleased]

### Added

- Aggregated root `CHANGELOG.md` (this file).
- `examples/` directory with three runnable, end-to-end usage snippets
  (`01-cli-scan`, `02-ci-gate`, `03-evidence-bundle`).
- `.github/FUNDING.yml` pointing at the project home page.

## [0.1.0-rc.1] — 2026-05-19

First public release candidate. The monorepo went live under
`ariada-org/ariada` on this date; everything below describes the state of the
repository at the cut.

### Added

- **`@ariada-org/wcag-rules-extended`** — EAA 2025-ready WCAG 2.2 AA rule
  packs for axe-core. Three packs covering 31 rules across the most
  enforcement-active surfaces:
  - Pack A — e-commerce checkout flow (EAA Annex I §I.3), 11 rules.
  - Pack B — accessibility statement compliance (DOS-lagen / EN 301 549),
    10 rules.
  - Pack C — banking digital channels + Nordic locale handling (EAA Annex I
    §I.4), 10 rules.
  - 524 vitest unit tests plus 45 Playwright cross-engine end-to-end tests
    (Chromium / Firefox / WebKit) across five showcase rules.
  - Multilingual error / help messages: English plus Nordic 4 (sv / nb /
    da / fi).
  - Public API: `addEaaRules(axe)`, `eaaConfig()`, individual `*Pack`
    exports.

- **`@ariada-org/evidence-emitter`** — Machine-readable compliance evidence
  emitters from a normalised violation list:
  - `emitVpat(violations, meta)` — VPAT 2.5 JSON (US Section 508 / ITI).
  - `emitEn301549(violations, meta)` — EN 301 549 v3.2.1 §11 Conformance
    Statement.
  - `emitDosLagen(violations, meta, options)` — Swedish DOS-lagen statement
    (DIGG guidelines).
  - Full WCAG 2.2 SC catalogue (87 criteria, A / AA / AAA).

- **`@ariada-org/penalty-estimator`** — Risk-model estimator for EAA
  enforcement exposure across 11 jurisdictions (SE / NO / DK / FI / DE / FR
  / NL / AT / CH / UK / EU). Per-jurisdiction caps, base fines, sector and
  impact multipliers calibrated from regulator reports 2022-2025.

- **`@ariada-org/cli`** — Single-binary command-line runner. Subcommands:
  `scan`, `list-rules`, `version`, `generate-statement`, `estimate-penalty`,
  and the `diff` family (`classify`, `gate`, `inspect`, `explain`, `replay`,
  `exempt`). Exit codes follow the standard a11y-tooling convention
  documented in `packages/ariada-cli/README.md`.

- **`@ariada-org/eaa-pipeline`** — Reusable GitHub Actions workflow at
  `.github/workflows/eaa-audit.yml`. Callers reference it with one
  `uses:` line, get a PR comment with the violation summary, a SARIF upload
  consumed by GitHub Security, and an artefact bundle with `report.json`
  plus optional accessibility-statement HTML and VPAT.

- **`@ariada-org/haes`** — Hash-anchored Evidence Stream. Tamper-evident
  append-only ledger primitives for AI-artifact transparency under
  EU Regulation 2024/1689 Article 50 (schema + reference client + Merkle
  anchor primitives).

- **`@ariada-org/core`** — Programmatic `scan(url, opts)` API, plugin
  registry, element-iteration mode emitting a locked `ScanEvent` stream.

- **`@ariada-org/rules-axe`** — axe-core adapter bundled by `@ariada-org/core`.

- **Statement generator** (`packages/wcag-rules-extended/src/statement/`) —
  `generateStatement(violations, meta, options)` emitting HTML or MDX.
  Nordic 4 + English locales. Nordic jurisdictions (SE / NO / DK / FI) with
  national-enforcement-authority URLs. Structure follows Directive 2016/2102
  art. 7 template.

- **EU real-world test fixtures** (`packages/ariada-test-fixtures/`) — 16
  fixtures across 5 pattern categories (Klarna-style / BankID-style /
  MobilePay-style / Finnish Avi-style / Mittelstand DE / French RGAA). All
  CC0-1.0 — original synthetic content, no vendor markup copied.

- **Static-analysis baseline** — SonarCloud, Semgrep, Snyk, Gitleaks, CodeQL,
  OpenSSF Scorecard, SBOM generation, dependency review.

- **REUSE 3.3 compliance** across all public-eligible packages (per-file
  SPDX-FileCopyrightText + SPDX-License-Identifier headers, plus
  `LICENSES/` directory at repo root).

- **Patent Peace Pledge** in `packages/wcag-rules-extended/NOTICE`,
  cross-referenced from the package and root `NOTICE` files.

### Security

- Private vulnerability reporting via GitHub Security Advisories — see
  `SECURITY.md`.
- Gitleaks scan on every push.
- OpenSSF Scorecard published to a public branch.

### Licensing

- Code: EUPL-1.2 (per-package `LICENSE` files + per-source SPDX headers).
- Fixtures: CC0-1.0.
- Documentation prose: CC-BY-SA-4.0.

[Unreleased]: https://github.com/ariada-org/ariada/compare/v0.1.0-rc.1...HEAD
[0.1.0-rc.1]: https://github.com/ariada-org/ariada/releases/tag/v0.1.0-rc.1
