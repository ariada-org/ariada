<!-- SPDX-FileCopyrightText: 2025-2026 Agonist Development AB -->
<!-- SPDX-License-Identifier: CC-BY-SA-4.0 -->
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] — 2026-05-20

### Added

- Initial release.
- MCP server skeleton with stdio transport (NDJSON-framed JSON-RPC 2.0).
- Four tools: `ariada.scan`, `ariada.list-rules`, `ariada.explain-violation`, `ariada.suggest-fix`.
- Resource catalogue: `rules://catalogue` and per-pack variants.
- Prompt template: `fix-violation-prompt`.
- SSRF guard refusing private-network and non-HTTP URLs by default.
- `--allow-private` opt-in flag for local development scans.
- Library entry-points re-exported from `dist/index.js` for programmatic use.
- Zod schemas as the single source of truth for tool inputs.
