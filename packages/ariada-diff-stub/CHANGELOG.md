# Changelog

All notable changes to `@ariada-org/diff-stub` are recorded in this file.
Format follows [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/).
SemVer.

Dates are ISO 8601 (UTC).

## Unreleased

### Added

- Initial public surface of `@ariada-org/diff-stub` — equality-only OSS
  reference classifier for the differential accessibility CI gate:
  - `classifyStub` function producing a DiffResult with
    `engine_info.classifier === "stub"`.
  - `STUB_NOT_CANONICAL_BANNER` warning string for downstream UI.
- Vitest unit + integration tests covering equality matching, shape
  parity vs the canonical engine, and the «no near-duplicate emission»
  invariant.
- REUSE 3.3 compliance metadata.
- `SECURITY.md` with private-vulnerability-reporting policy.
