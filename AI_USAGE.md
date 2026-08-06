<!-- SPDX-FileCopyrightText: 2026 Agonist Development AB -->
<!-- SPDX-License-Identifier: EUPL-1.2 -->

# AI Usage Disclosure

> The project keeps a binding human-authorship policy, which this document
> summarises; where a funder asks for more detail, that detail is supplied with
> the application rather than published here.

This repository was developed with AI assistance and discloses that use openly per **NLnet Foundation's Generative AI Policy v1.1** (effective 2026-01-26): https://nlnet.nl/foundation/policies/generativeAI/

## Tool used

- **Model:** Anthropic Claude Opus 4.7 (model identifier `claude-opus-4-7`)
- **Interface:** Claude Code CLI (https://claude.com/claude-code)
- **Predecessor models:** Claude 4.5 / 4.6 were used for earlier commits (2026-04 to 2026-05-13); migrated to 4.7 on 2026-05-13

## Scope of AI assistance

| Artefact class | AI-drafted share | Human reviewer protocol |
|---|---|---|
| WCAG / EAA rule definitions in `packages/wcag-rules-extended/src/rules/**/*.ts` | 70-85% drafting + 100% standards citation typed under human direction | Founder reads `git diff` before commit + verifies WCAG SC / EN 301 549 / EAA Annex I citations against primary standards documents |
| Helper utilities (`helpers.ts`, `test-utils.ts`, `types.ts`) | 80-90% drafting | Founder reviews; refactors where AI output produces wider-than-needed type signatures |
| Adjacent infrastructure packages (`core-engine`, `regulatory-mappings`, `eaa-pipeline`, `ariada-cli`, `ariada-test-fixtures`) | 60-80% drafting (varies; CLI surface higher human input) | Per-commit `git diff` review, plus the lint, typecheck and test gates the repository runs before any push |
| Tests (`*.test.ts`) | 80-90% drafting | Founder authored each rule's behavioural contract; reviews fixtures + assertions |
| Build/packaging artefacts | Mixed — boilerplate AI-scaffolded; package-name + scope decisions human | Founder edits-and-approves each file |
| Documentation (`docs/**/*.md`) | 70-85% drafting | Founder verifies factual claims + standards-citation chain |

## Human author of record

Under copyright law (Thaler v. Perlmutter US 2023; CJEU Infopaq EU), **Alexander Brichkin (Agonist Development AB, Sweden, organisation number 559452-5726)** is the human author of record for every commit in this repository. AI assistance is a tool; legal authorship is the human.

## Commitment

- **No AI co-author trailers** on commits after 2026-05-13 (a small number of pre-policy commits predate this rule and are disclosed as such rather than rewritten)
- **DCO sign-off** (`Signed-off-by:`) required on every commit
- **Conventional Commits** format enforced
- **Per-commit `git diff` review** by human before push
- **CI gates** (commit-message discipline, licence and attribution guards) run on every push

## Two-phase GenAI provenance pipeline

Effective 2026-05-25, substantive GenAI-assisted code, tests, CI, and
grant-facing documentation use a two-phase pipeline before public release:

1. **GenAI draft commit.** The draft commit records the model/interface used,
   links to an in-repository prompt/provenance log, and is not treated as
   release-ready. Its Git author name includes the model/tool marker, for
   example `Alexander Brichkin with OpenAI Codex GPT-5.5 <git@ariada.org>`,
   and its message includes `Prompt:` and `Output:` fields.
2. **Human verification commit.** A separate human verification commit is made
   at least 72 hours after the GenAI draft commit. It references the draft SHA
   and records the human review: diff review, primary-source checks,
   copyright/FLOS suitability, tests, and any changes made. Its Git author name
   is the human reviewer only, without a model/tool marker.

If the GenAI draft has no technical mistakes, the human verification commit
still adds or updates a review/provenance report. It is not an empty commit and
does not present the generated output as ordinary human-only work.

If a GenAI draft fails internal audits, lint, tests, legal checks, or standards
review, the failure is recorded in the review/provenance report. Fixes made
after those failures are human verification commits where practical. If GenAI is
used again to produce the fix, that fix starts a new GenAI draft cycle and the
72-hour waiting period restarts.

Only verified work, or a squashed public commit carrying equivalent provenance
metadata, may enter the public release queue. Existing public history is not
rewritten; pre-2026-05-25 provenance limitations are disclosed forward instead.

See `docs/decisions/2026-05-25-genai-provenance-release-pipeline.md`.

## Retroactive review of pre-policy public work

Public commits created before 2026-05-25 are not rewritten. Instead, the project
is running a retroactive human review campaign over already-published code and
documentation. Review evidence is recorded under `docs/provenance/reviews/`.

The campaign does not fabricate missing prompt logs. It records what can be
verified now: reviewed baseline, file/module scope, human checks performed,
test/build evidence, corrected claims, and residual uncertainty.

See `docs/provenance/retroactive-genai-review-plan-2026-05-25.md`.

## Cross-references

- **GenAI release-pipeline ADR:** `docs/decisions/2026-05-25-genai-provenance-release-pipeline.md`
- **Retroactive review plan:** `docs/provenance/retroactive-genai-review-plan-2026-05-25.md`
- **External authority:** https://nlnet.nl/foundation/policies/generativeAI/

## Why this disclosure exists

Three reasons:

1. **Policy compliance.** NLnet GenAI Policy v1.1 mandates disclosure of model + dates + scope + reviewer protocol.
2. **Risk mitigation.** Internal research confirms undisclosed AI use is the highest-cited rejection cause in OSS-grant funder communications since 2024; disclosed AI use is normalised.
3. **Copyright-validity discipline.** Per Thaler v. Perlmutter + CJEU Infopaq, copyright requires human authorship — clean disclosure preserves human authorship of record.

## Updates

| Version | Date | Author | Change |
|---|---|---|---|
| v0.1 | 2026-05-22 | Alexander Brichkin | Initial AI_USAGE.md at repository root. |
| v0.2 | 2026-05-25 | Alexander Brichkin | Add two-phase GenAI provenance pipeline with a 72-hour human verification window. |
| v0.3 | 2026-05-25 | Alexander Brichkin | Add retroactive human review plan for pre-policy public work. |
