<!-- SPDX-FileCopyrightText: 2025-2026 Agonist Development AB -->
<!-- SPDX-License-Identifier: CC-BY-SA-4.0 -->

# @ariada-org/eaa-pipeline

Reusable GitHub Actions workflow that scans public URLs with `@ariada-org/wcag-rules-extended`, generates an accessibility statement, and uploads VPAT-JSON evidence as build artefacts.

[![License: EUPL-1.2](https://img.shields.io/badge/license-EUPL--1.2-blue)](LICENSE)
[![CI](https://github.com/ariada-org/ariada/actions/workflows/ci.yml/badge.svg)](https://github.com/ariada-org/ariada/actions)

## Quick-start

```yaml
# .github/workflows/eaa-audit.yml in your repo
name: EAA audit
on: [push, pull_request]
jobs:
  audit:
    uses: ariada-org/ariada/.github/workflows/eaa-audit.yml@v1
    with:
      site-url: "https://example.com"
      pages: "/,/checkout/,/accessibility/"
      fail-on: "serious,critical"
```

First run ~3 min; cached runs ~90 s for a five-page audit. No account, no API key, no outbound telemetry — runs entirely inside the caller's runner.

## What this package does

A single [reusable workflow](https://docs.github.com/en/actions/sharing-automations/reusing-workflows) (`eaa-audit.yml`) any GitHub Actions caller invokes with one `uses:` line. The workflow installs Node 22 + pnpm + axe-core + `@ariada-org/wcag-rules-extended` into a scratch project, scans each URL in `pages`, and uploads a single artefact bundle: a JSON violation report, an optional HTML accessibility statement, and an optional VPAT-JSON + `.well-known/accessibility.json` pair.

A [SARIF 2.1.0](https://docs.oasis-open.org/sarif/sarif/v2.1.0/sarif-v2.1.0.html) report is also generated and uploaded to the caller repo's GitHub Security tab via `github/codeql-action/upload-sarif@v3`. axe-core's 4-level impact taxonomy is mapped to SARIF's 3-level severity (`critical` / `serious` → `error`, `moderate` → `warning`, `minor` → `note`); raw impact is preserved in `properties.impact`. Result count is capped at 25 000 per GitHub policy; the workflow truncates by impact priority and logs a `::warning::` if exceeded.

The workflow is independent of any commercial service. Both the rule pack and the workflow are EUPL-1.2.

## What this package does NOT do

Public URLs only — the workflow scans what GitHub-hosted runners can reach. Localhost, intranet, VPN-only, and IP-allowlisted sites are out of scope (use the rule pack directly inside your own CI for those). The scanner is axe-core via `@axe-core/cli` (headless Chromium): it loads JavaScript but does not click, fill forms, or sign in. For scripted scenarios use the rule pack with a Playwright / Puppeteer harness. The workflow detects and reports — it does not patch code or remediate violations.

## Inputs (summary)

| Input            | Required | Default            | Description                                                                            |
| ---------------- | -------- | ------------------ | -------------------------------------------------------------------------------------- |
| `site-url`       | yes      | —                  | Base URL to scan; must be `https://` and publicly reachable.                           |
| `pages`          | no       | `/`                | Comma-separated paths appended to `site-url`.                                          |
| `fail-on`        | no       | `serious,critical` | axe-core impact levels that cause the job to fail (`minor,moderate,serious,critical`). |
| `emit-statement` | no       | `true`             | Render an EAA-style accessibility-statement HTML file.                                 |
| `emit-evidence`  | no       | `true`             | Render `vpat.json` + `accessibility.json` (suitable for `.well-known/`).               |
| `pack-version`   | no       | `next`             | npm dist-tag or semver of `@ariada-org/wcag-rules-extended`.                           |
| `runner`         | no       | `ubuntu-latest`    | GitHub-hosted runner label.                                                            |

Full reference: [`docs/INPUTS.md`](docs/INPUTS.md).

## Outputs

| Output             | Type    | Description                                                |
| ------------------ | ------- | ---------------------------------------------------------- |
| `violations-count` | number  | Total violations summed across all impact levels.          |
| `report-artefact`  | string  | Uploaded artefact name (`eaa-audit-${{ github.run_id }}`). |
| `sarif-uploaded`   | boolean | `'true'` iff SARIF upload succeeded.                       |
| `status`           | string  | One of `pass`, `fail`, `error`.                            |

Full reference: [`docs/OUTPUTS.md`](docs/OUTPUTS.md). Exit codes are documented in [`docs/EXIT_CODES.md`](docs/EXIT_CODES.md).

## Regulatory mapping

- WCAG 2.2 AA — W3C Recommendation (2023-10-05), implemented via `@ariada-org/wcag-rules-extended`
- EN 301 549 v3.2.1 — ETSI harmonised standard (2021-03), via rule-pack clause mapping
- EAA Annex I — Directive (EU) 2019/882 §I.1 (statement), §I.3 (checkout), §I.4 (banking)
- Directive (EU) 2016/2102 art. 7 — accessibility-statement template
- SARIF 2.1.0 — OASIS, for GitHub Security tab integration

## Tests + verification

31 tests across 2 files (Node `node:test`) covering SARIF builder output, axe-core JSON aggregation, and PR-comment rendering (top-5 block, 65 KB GitHub comment cap). Run with `node --test tests/unit/*.test.mjs`. Example workflows in [`examples/`](examples) are exercised end-to-end against `https://ariada.org` in CI.

## Versioning

[GitHub Actions versioning convention](https://docs.github.com/en/actions/sharing-automations/creating-actions/about-custom-actions#using-release-management-for-actions):

- `@v1` — moving major-version tag, advanced on each `v1.x.y` release.
- `@v1.0.0` — immutable semver tag (recommended for pinning).
- `@<sha>` — commit hash. Required for callers running OpenSSF Scorecard ≥ 8.

Tag policy in [CHANGELOG.md](CHANGELOG.md).

## Sibling packages

- [`@ariada-org/wcag-rules-extended`](../wcag-rules-extended) — the rule pack the workflow runs
- [`@ariada-org/evidence-emitter`](../ariada-evidence-emitter) — emits the VPAT / EN 301 549 / DOS-lagen JSON
- [`@ariada-org/statement-generator`](../ariada-statement-generator) — renders the accessibility statement

## License

EUPL-1.2 — see [LICENSE](LICENSE). axe-core (MPL-2.0) and `@axe-core/cli` (MPL-2.0) attribution in [NOTICE](NOTICE).
