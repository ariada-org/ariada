<!--
SPDX-FileCopyrightText: 2026 Agonist Development AB
SPDX-License-Identifier: EUPL-1.2
-->

# ADR-0002: IP separation discipline — `IP_NEGATIVE_LIST.md` and CI guard

## Status

Accepted

## Date

2026-04-01

## Context

The project publishes accessibility rules under EUPL-1.2 as a genuine OSS contribution, while Agonist Development AB holds USPTO provisional applications covering separate inventions in adjacent compliance-tooling subject matter. There is a real risk that a careless commit could introduce rule logic, helper code, or documentation that embodies one of the patented inventions, blurring the boundary between the OSS work and the proprietary portfolio.

Two specific failure modes were identified:

1. A rule's helper function inadvertently implements a heuristic that reads on a patent claim — making the OSS version a prior-art publication against the maintainer's own portfolio, or triggering an infringement action against a downstream user who extends the rule.
2. A comment or documentation file mentions a patented sub-system by an internal name, revealing the existence of the proprietary system to competitors before the relevant applications are mature.

These failure modes are independent of developer intent — they can happen during routine refactoring.

## Decision

Two controls are implemented together:

**1. `IP_NEGATIVE_LIST.md` per package** — a machine-readable and human-readable list of keywords representing patent-territory concepts that must not appear in any public OSS commit. Located at `packages/wcag-rules-extended/IP_NEGATIVE_LIST.md`. Updated quarterly against active patent claims.

**2. CI guard against the negative list** — a CI step that greps every push and pull request diff for tokens from the negative list and fails the build with a descriptive error if any match is found. The current implementation lives in the maintainer's authoring tooling and runs server-side as part of the audit pass; contributors see the verdict in the PR status. This prevents the failure modes above from reaching the public repository even if the developer misses the manual check.

Both controls are documented in `CONTRIBUTING.md` so external contributors understand the boundary before they submit a patch.

## Consequences

- **Positive:** provably enforced IP boundary; any reviewer can verify separation by inspecting CI logs; protects EUPL-1.2 enforceability by keeping OSS and proprietary claims separate.
- **Negative:** the negative list must be actively maintained as the patent portfolio matures (quarterly review cadence added to `docs/adrs/NNNN-update-ip-negative-list.md` convention); false positives possible if a token is too common (mitigated by using precise compound phrases rather than single words).
- **Neutral:** the CI guard runs in under one second on typical diff sizes — no material latency added to CI pipeline.

## Alternatives considered

- Manual code review only: insufficient — depends on reviewer recall of patent claims, which changes over time as claims are prosecuted.
- Legal-review gate before each commit: too slow for daily OSS cadence.
- Separate repository for OSS vs proprietary: eliminates the risk at the cost of developer ergonomics and the monorepo CI efficiency.

## References

- `packages/wcag-rules-extended/IP_NEGATIVE_LIST.md` — token list
- `CONTRIBUTING.md` — contributor education on IP boundary
- ADR-0001 (`docs/adrs/0001-license-eupl-1.2.md`) — why EUPL-1.2 plus narrow patent peace
