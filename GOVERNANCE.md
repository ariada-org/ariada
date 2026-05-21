<!--
SPDX-FileCopyrightText: 2026 Alekszandr Bricskin (Agonist Development AB, Sweden, org.nr 559452-5726)
SPDX-License-Identifier: CC-BY-SA-4.0
-->

# Governance

This document describes how the `ariada-org/ariada` project is maintained, how
decisions are made, and how new contributors and maintainers join the project.
It is intentionally short: the project is in its first public release stage,
and governance complexity will grow only when contributor count justifies it.

## Maintainer model

**Stage 1 (current — first public release).** The project is maintained by a
single primary maintainer:

- Alekszandr Bricskin (Agonist Development AB, Sweden, org.nr 559452-5726)

Solo maintainership is explicitly acknowledged as a transitional state, not a
target. The maintainer holds commit and release rights, reviews and merges
pull requests, and is responsible for security disclosures coordinated under
`SECURITY.md`.

**Stage 2 (target — by the second project milestone).** Recruit at least one
co-maintainer with independent commit rights. Candidates will be drawn from
sustained contributors (≥5 substantive landed PRs and demonstrated review
quality) and from the accessibility / open-source ecosystem at large.

The intent is to move the project from single-point-of-failure governance to
a small, stable maintainer team before the project's user base grows past the
point where a solo maintainer can responsibly handle security response.

## Decision process

**Stage 1.** Benevolent-dictator model. The primary maintainer makes the final
call on technical direction, dependency choices, license decisions, breaking
changes, and release timing. Public discussion happens in GitHub Issues and
Pull Requests; the maintainer documents the rationale of contentious calls
in commit messages or design notes.

**Stage 2 (once three or more active maintainers).** Transition to lazy
consensus: proposals stand unless a maintainer formally objects within a
posted review window. Disagreements escalate to maintainer vote; ties favour
the status quo.

In both stages, the project follows the public roadmap published in the root
`ROADMAP.md` (once landed) and the per-package `CHANGELOG.md` files. Roadmap
revisions are themselves PR-reviewed.

## Code review

- All changes — including those from the primary maintainer — go through pull
  requests against the public default branch.
- Automated review runs first: CI (build, unit tests, integration tests,
  lint, type-check, REUSE compliance, dependency review, security scanning).
- A code-review assistant (CodeRabbit) auto-comments on each PR.
- A maintainer approval is required before merge. The primary maintainer's
  own PRs may be self-merged once all automated checks pass and CodeRabbit
  has had a chance to comment; this self-merge path will be removed in
  Stage 2 once a second maintainer is in place.
- Security-sensitive changes (auth, dependency upgrades affecting trust
  boundaries, anything touching evidence-handling) require explicit reviewer
  acknowledgement in the PR description.

## Releases

- Versions follow [Semantic Versioning 2.0.0](https://semver.org/).
- Releases are managed with [Changesets](https://github.com/changesets/changesets):
  each PR that ships a user-visible change includes a `.changeset/` entry
  describing the change and its semver bump level.
- Per-package `CHANGELOG.md` files are generated from changeset entries on
  release.
- Releases are tagged in git, published to GitHub Releases with notes derived
  from the per-package CHANGELOGs, and (for packages marked publishable)
  pushed to npm under the `@ariada-org/` scope with npm provenance.
- All code is released under the European Union Public Licence v. 1.2
  (EUPL-1.2). Prose under `CC-BY-SA-4.0`; fixtures under `CC0-1.0`. SPDX
  identifiers are tracked per-file via REUSE 3.3 metadata.

## Maintainer succession and hand-off

If the primary maintainer becomes unable or unwilling to continue
maintenance, the project's preferred succession path is:

1. **Active co-maintainers, if any** assume primary responsibility by
   internal agreement.
2. **OpenJS Foundation** Accessibility Working Group is the first external
   fallback for stewardship, given the project's web-accessibility focus.
3. **W3C ARIA-AT** community group is the secondary external fallback.

A concrete commitment of this governance document: the primary maintainer
will actively recruit at least one co-maintainer before the second project
milestone, so that even informal succession does not depend on external
foundations being available.

In the event none of the above paths is available, the EUPL-1.2 licence
ensures that any individual or organisation may fork and continue the
project under their own governance. The `LICENSE`, `NOTICE`, and per-file
SPDX headers are sufficient to support such a fork without further
permission.

## Contact

- General governance questions: <governance@ariada.org>
- Security disclosures: see [`SECURITY.md`](./SECURITY.md)
- Code of conduct concerns: see [`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md)
- Trademark / brand questions: see [`TRADEMARK.md`](./TRADEMARK.md) once
  published

## History

For the project's working history, see the public commit log at
<https://github.com/ariada-org/ariada/commits/main> and the per-package
`CHANGELOG.md` files under `packages/*/CHANGELOG.md`.
