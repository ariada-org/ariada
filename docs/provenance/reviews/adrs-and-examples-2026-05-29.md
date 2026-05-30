<!-- SPDX-FileCopyrightText: 2026 Agonist Development AB -->
<!-- SPDX-License-Identifier: CC-BY-SA-4.0 -->

# Review report — Architecture decision records and examples (2026-05-29)

## Scope

- `docs/adrs/0001-license-eupl-1.2.md` through `docs/adrs/0007-standards-citation-discipline.md`
- `examples/01-cli-scan/` and `examples/03-evidence-bundle/` sample projects

## Verdict

**Clean** — the review found minor prose issues that have been corrected in the same commit so the index and the underlying text move together.

## Adjustments applied

1. Two stale cross-references in the ADR set have been updated to point at the
   current file locations that exist in the public tree.
2. Two ADRs (0001 and 0002) have been revised for clarity in the parts of the
   text that describe the patent rationale for the licence choice; the new
   prose uses neutral descriptive language without project-specific acronyms.
3. The expected-output paragraph in `examples/01-cli-scan/README.md` has been
   corrected against what the scanner actually emits on a sparse sample
   document — it now lists the structural findings (`html-has-lang`,
   `landmark-one-main`, `page-has-heading-one`, and the `region` results) in
   addition to the six deliberately-failing WCAG criteria.
4. The acronym `HAES` has been expanded at first use in
   `examples/03-evidence-bundle/package.json`.

No behavioural code change. No public API change.

## Attestation

The full attestation trailer (Diff ID, Reviewer, Date, Review evidence) is in
the body of the public commit that adds this report. Per the framework at
[`../retroactive-genai-review-plan-2026-05-25.md`](../retroactive-genai-review-plan-2026-05-25.md),
the underlying signed review packet is held by the maintainer.

## Cross-references

- Framework: [`../retroactive-genai-review-plan-2026-05-25.md`](../retroactive-genai-review-plan-2026-05-25.md)
- Status index: [`STATUS.md`](./STATUS.md)
- AI usage statement: [`../../../AI_USAGE.md`](../../../AI_USAGE.md)
