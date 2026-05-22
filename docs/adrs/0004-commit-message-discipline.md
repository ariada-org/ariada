<!--
SPDX-FileCopyrightText: 2026 Agonist Development AB
SPDX-License-Identifier: EUPL-1.2
-->

# ADR-0004: Commit message discipline — Conventional Commits, DCO, no AI co-author trailers

## Status

Accepted

## Date

2026-05-13

## Context

The repository's commit history is a primary audit surface for NLnet grant reviewers, security researchers, and downstream consumers. Three commit-message disciplines need to be enforced together:

1. **Conventional Commits format** — enables automated changelog generation, semantic versioning decisions, and clear human scanning of the history. The format `<type>(<scope>): <subject>` with an optional body and footer is the de facto standard for TypeScript monorepos using Changesets or release-please.

2. **Developer Certificate of Origin (DCO) sign-off** — the `Signed-off-by: <name> <email>` trailer is a legally meaningful statement that the contributor certifies they have the right to submit the code under the project's license (per https://developercertificate.org/). Many OSS funders, including NLnet, look for DCO as evidence of provenance discipline.

3. **No AI co-authorship trailers** — `Co-Authored-By: Claude` trailers are legally ambiguous. They imply co-authorship, which (under Thaler v. Perlmutter US 2023 and CJEU Infopaq) could be interpreted as a claim that an AI co-authored the code — undermining human copyright authorship. See ADR-0003 for the full reasoning.

Before 2026-05-13, commits mixed formats and some included AI co-author trailers. A consistent discipline is needed for the period from the first public push onward.

## Decision

**Format:** Every commit uses Conventional Commits: `<type>(<scope>): <subject>` on the first line (≤72 characters), optional blank line, optional body (≤100 characters per line), optional footer. Permitted types: `feat`, `fix`, `docs`, `chore`, `refactor`, `test`, `ci`, `perf`, `style`, `build`, `revert`.

**DCO:** Every commit from 2026-05-22 onward carries `Signed-off-by: Alexander Brichkin <git@ariada.org>` produced by `git commit -s`. The CI workflow `.github/workflows/dco.yml` enforces this on every pull request.

**No AI trailers:** commits must not contain `Co-Authored-By: Claude`, `Co-Authored-By:` referencing any AI model or agent, or `Generated with Claude Code`. The `scripts/check-commit-messages.sh` script checks for these patterns. If AI assistance is noted, it belongs in the commit body as a plain-prose sentence, not in a structured trailer.

**Author identity:** commit author is `Alexander Brichkin (Agonist Development AB) <git@ariada.org>` — the email domain `ariada.org` is the OSS project domain; this avoids the founder's personal email being scraped from public commit metadata.

**Pre-2026-05-13 commits:** the legacy commits that pre-date this policy carry mixed formats and some AI trailers. These are documented as a known limitation in `AI_USAGE.md` §«Commitment» and are not rewritten.

## Consequences

- **Positive:** clean audit surface; DCO provenance; automated changelog viability; NLnet reviewer confidence.
- **Negative:** discipline requires `git commit -s` habit — enforced by CI gate on PRs but not on direct commits to the branch. A local git hook (`prepare-commit-msg`) can assist but is not currently checked in.
- **Neutral:** the author identity change from `git@agonist.ai` (some legacy commits) to `git@ariada.org` creates a minor inconsistency in author email across the history — acceptable as a one-time transition cost.

## Alternatives considered

- Angular commit format: similar to Conventional Commits but less widely tooled in the JavaScript ecosystem; Conventional Commits preferred.
- No DCO, CLA instead: Contributor License Agreement requires a signature process; DCO is lighter-weight and more appropriate for a solo-maintainer EUPL-1.2 project at this stage.
- Keep AI co-author trailers for transparency: the legal-ambiguity risk outweighs the transparency benefit; plain-prose body disclosure is the safer equivalent.

## References

- Conventional Commits specification: https://www.conventionalcommits.org/en/v1.0.0/
- Developer Certificate of Origin: https://developercertificate.org/
- `.github/workflows/dco.yml` — CI enforcement
- `commitlint.config.js` — local enforcement via commitlint
- ADR-0003 (`docs/adrs/0003-ai-assistance-protocol.md`) — AI trailer policy rationale
