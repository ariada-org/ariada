# Changelog

All notable changes to `@ariada/diff-action` are recorded in this file.
Format follows [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/).

Dates are ISO 8601 (UTC).

## Unreleased

### Added

- Initial composite GitHub Action surface for the differential
  accessibility CI gate:
  - `action.yml` declaring all 8 inputs + 6 outputs.
  - `scripts/run-diff.sh` glue invoking `@ariada/cli` and propagating
    outputs to `$GITHUB_OUTPUT`.
  - `scripts/post-pr-comment.mjs` PR-comment renderer.
- Local E2E fixture workflow for nektos/act.
- REUSE 3.3 compliance metadata.
- `SECURITY.md` with private-vulnerability-reporting policy.
