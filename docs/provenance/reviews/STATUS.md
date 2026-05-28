<!-- SPDX-FileCopyrightText: 2026 Agonist Development AB -->
<!-- SPDX-License-Identifier: CC-BY-SA-4.0 -->

# Retroactive Human-Review Status

This index records the slices of pre-policy public history that have received
forward human verification under the framework at
`docs/provenance/retroactive-genai-review-plan-2026-05-25.md`.

The framework took effect 2026-05-25. Public commits before that date were
not produced under the two-phase GenAI provenance pipeline. Per the framework
the project does not rewrite that history; instead, a named human reviewer
verifies the published work slice by slice and records the verification as a
normal public commit whose body carries the Diff ID and the attestation.

This index is updated as new slices are attested. It lists what has been
reviewed, the public commit range each slice covers, the attestation date,
and the public SHA of the attestation commit so a reader can follow the
attestation back to the underlying signed-off review.

## Reviewed slices

| Slice | Public commit range reviewed | Attestation date | Attested at public SHA |
|---|---|---|---|
| Core scanner runtime — browser adapter | `db4331e8`..`284ed3b1` (original + four follow-up fixes) | 2026-05-27 | `7b7cccd3` |
| GitHub Actions workflows | `9a00f45c`..`fe84ddb9` (CI definitions through CodeQL hardening) | 2026-05-27 | `08b90eb8` |
| Public-trust surface | `README.md`, `AI_USAGE.md`, `NOTICE`, `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`, `REUSE.toml`, `LICENSES/` at `c142b7e4` | 2026-05-27 | `36940278` |
| `@ariada-org/*` packages — initial OSS batch | `9a00f45c`..`c142b7e4` (multi-package commit range) | 2026-05-27 | `fe23592a` |
| Core scanner runtime — engine kernel | `e4914bb7`..`82e65ea2` (initial engine/adapter split through public HEAD) | 2026-05-29 | (this commit; verdict clean-with-fixes — JSDoc brand mentions rewritten in this same change) |
| Core scanner runtime — headless adapter | `e4914bb7`..`964be45a` (initial split through current public HEAD) | 2026-05-29 | (this commit; verdict clean-with-fixes — README brand mentions and four test-file author comments rewritten in this same change) |
| Rule packs — WCAG extended | `0522f849`..`3fcf9352` (package shell through public HEAD) | 2026-05-29 | (this commit; verdict clean-with-fixes — CODE_OF_CONDUCT contact address corrected, two test-file author bylines updated, one advisory SC-3.2.6 documentation note deferred) |

## Slices not yet reviewed

The following slices remain in scope for forward verification and are not yet
recorded in the table above. They are listed so a reader can see the planned
coverage and so the project's own roadmap stays explicit.

- Command-line interface and adapters
- Pipeline, statement generator, and renderers
- Husky pre-commit and pre-push hooks
- Architecture decision records and examples

## How to verify an attestation

Each row above points at a public commit SHA in the `Attested at public SHA`
column. That commit's body contains the attestation trailer:

- the Diff ID covering the reviewed surface;
- the reviewer name;
- the date of attestation;
- a pointer to the underlying review evidence held in the maintainer's
  internal workspace.

The internal review evidence is intentionally not published to the public
repository. The public attestation trailer is sufficient for a third party
to verify that a named human took responsibility for the reviewed slice on
the recorded date; the underlying evidence packet supports the maintainer's
own audit trail and is available on request through the project's
established communication channels.

## Cross-references

- Framework: `docs/provenance/retroactive-genai-review-plan-2026-05-25.md`
- AI usage statement: `AI_USAGE.md`
