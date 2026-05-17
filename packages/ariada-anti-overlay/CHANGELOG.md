<!--
SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
SPDX-License-Identifier: CC-BY-SA-4.0
-->

# Changelog

All notable changes to this package are documented here. Format follows
Keep a Changelog v1.1.0; versioning follows Semantic Versioning 2.0.0.

## [0.1.0] — 2026-05-20

### Added

- Initial detection-only library for third-party accessibility-overlay widgets.
- Ten initial vendor signature modules:
  - accessiBe (standard JS-injected variant)
  - UserWay (Level Access)
  - EqualWeb / Accessibly
  - AudioEye (overlay-mode)
  - Recite Me
  - MaxAccess (Online ADA)
  - accessiBe (iframe variant, confidence capped at medium)
  - FACIL'iti
  - Purple Lens / PurpleHat / Purple Cube
  - Generic accessibility-toolbar catch-all heuristic (confidence locked at low)
- Confidence rubric (high / medium / low) with per-vendor cap support.
- Citations block always present in the report — W3C-WAI Accessibility Overlay glossary entry, OverlayFactsheet community statement, ISO `citationsLastVerified`, verbatim `NOT LEGAL ADVICE` disclaimer.
- Zero third-party runtime dependencies. URL input delegated to caller-supplied fetcher; no outbound network calls from the package itself.
- ReDoS-resistant linear-time regexes; tested with adversarial inputs.
- Unit tests for every signature module (≥ 3 fixtures each) plus orchestrator, confidence, citations, false-positive, ReDoS, and no-network suites.
