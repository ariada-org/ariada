<!--
SPDX-FileCopyrightText: 2026 Agonist Development AB
SPDX-License-Identifier: EUPL-1.2
-->

# ADR-0003: AI assistance protocol and human reviewer requirement

## Status

Accepted

## Date

2026-05-13

## Context

This repository was developed with substantial AI assistance (Anthropic Claude Opus 4.7 via Claude Code CLI). Approximately 70–90% of the source code, test fixtures, and documentation was drafted by the AI under continuous human direction and supervision.

Three pressures converged to require a formal policy:

1. **NLnet GenAI Policy v1.1** (effective 2026-01-26, https://nlnet.nl/foundation/policies/generativeAI/) mandates disclosure of model, dates, scope, and reviewer protocol for any GenAI use in projects funded or applying for funding.

2. **Copyright law** (Thaler v. Perlmutter, US DC Circuit 2023; CJEU Infopaq jurisprudence) requires human authorship for copyright to attach. AI output alone is not copyrightable. Maintaining Alexander Brichkin as the human author of record on every commit is legally required to preserve EUPL-1.2 enforceability.

3. **Early contributors** lacked a clear policy and some commits (before 2026-05-13) carried `Co-Authored-By: Claude` trailers, which — while well-intentioned — are legally ambiguous co-authorship claims that could weaken copyright validity.

## Decision

The AI assistance protocol is:

**Disclosure:** Every file that uses AI-assisted content prominently references `AI_USAGE.md` at the repository root. The `AI_USAGE.md` file discloses model, interface, scope, dates, and reviewer protocol per NLnet GenAI Policy v1.1.

**No co-authorship trailers:** Commits must not contain `Co-Authored-By: Claude`, `Co-Authored-By: <any AI agent>`, or `Generated with Claude Code` trailers. AI is a tool; legal authorship is the human. The two pre-policy commits (`a9f6291d`, `6c128483`, 2026-05-13) that carry legacy trailers are documented as a known limitation in `AI_USAGE.md` and are not rewritten (history rewrite would break provenance).

**Human reviewer protocol:** Before every commit, the human reviewer (Alexander Brichkin) reads the full `git diff`, verifies any standards citations against primary documents (W3C WCAG 2.2, ETSI EN 301 549 v3.2.1, Directive (EU) 2019/882), and runs lint/typecheck/test gates locally. The reviewer retains final approval authority on every commit.

**DCO sign-off:** Every commit from 2026-05-22 onward carries a `Signed-off-by:` trailer (`git commit -s`) as the Developer Certificate of Origin, affirming the contributor has the right to make the contribution.

**PR template disclosure:** External contributors who use AI assistance must disclose it in the PR description using the AI-disclosure section of `.github/pull_request_template.md`.

## Consequences

- **Positive:** NLnet GenAI Policy v1.1 compliance; clean copyright chain; contributor clarity; reproducible audit trail.
- **Negative:** the legacy two commits with AI co-author trailers cannot be cleanly removed without a history rewrite that would invalidate existing tag provenance — documented as a limitation.
- **Neutral:** the reviewer protocol adds 5–15 minutes per commit for diff review + local gate execution — this is the intended discipline, not overhead to be eliminated.

## Alternatives considered

- No disclosure policy: non-compliant with NLnet GenAI Policy v1.1; copyright-validity risk.
- Retroactive history rewrite to remove legacy trailers: invalidates tag `v0.1.0-rc.1` provenance; creates confusion for any downstream consumer who has cloned. Rejected per constraint in `CONTRIBUTING.md`.
- AI co-authorship as first-class contributor: legally unclear; would weaken EUPL-1.2 enforceability and potentially invalidate NLnet grant eligibility.

## References

- `AI_USAGE.md` — repository-root AI assistance disclosure
- `GOVERNANCE.md` §«AI-attribution governance commitment»
- NLnet GenAI Policy v1.1: https://nlnet.nl/foundation/policies/generativeAI/
- `legal/HUMAN_AUTHORSHIP_POLICY.md` — binding human authorship invariant
- `.github/pull_request_template.md` §«AI assistance disclosure»
