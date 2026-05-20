<!-- SPDX-FileCopyrightText: 2025-2026 Agonist Development AB -->
<!-- SPDX-License-Identifier: CC-BY-SA-4.0 -->
# Changelog

All notable changes to this package will be documented in this file.

The format is based on [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/), and this package adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] — 2026-05-20

### Added

- Initial release. Static template analyzer for HTML, JSX, TSX, Vue, and Svelte files.
- Diagnostics for eight WCAG 2.2 + EAA static-tractable rules (image alt, form label, input name, button name, link purpose, heading order, empty heading, language of page).
- Hover provider rendering WCAG and EN 301 549 citations with `isTrusted: false`.
- Status-bar score widget using the placeholder formula `100 − (10·critical + 3·serious + 1·moderate)` clamped to `[0, 100]`.
- Commands: `ariada.scanCurrentFile`, `ariada.scanWorkspace`, `ariada.scanUrl`, `ariada.openReport`, `ariada.refreshDiagnostics`, `ariada.copyFindingCitation`, `ariada.showOutputChannel`.
- Configuration surface under the `ariada.*` namespace.
- Trusted Workspaces support with `untrustedWorkspaces.supported = "limited"`.
- Zero telemetry; no network egress on activation.
