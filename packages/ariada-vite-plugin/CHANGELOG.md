<!-- SPDX-FileCopyrightText: 2025-2026 Agonist Development AB -->
<!-- SPDX-License-Identifier: CC-BY-SA-4.0 -->
# Changelog

All notable changes to this package will be documented in this file.

The format is based on [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/), and this package adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] — 2026-06-22

### Added

- Initial release. Vite plugin that scans production HTML output and writes an Ariada accessibility report at build close.
- Optional coverage of the development `index.html` transform surface in the same report.
- Zero telemetry; no network egress during the build.
