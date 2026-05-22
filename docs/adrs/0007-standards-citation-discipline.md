<!--
SPDX-FileCopyrightText: 2026 Agonist Development AB
SPDX-License-Identifier: EUPL-1.2
-->

# ADR-0007: Standards citation discipline — per-rule WCAG SC, EN 301 549, and EAA Annex I mappings

## Status

Accepted

## Date

2026-04-10

## Context

The `@ariada-org/wcag-rules-extended` package claims to implement accessibility rules derived from WCAG 2.2, EN 301 549 v3.2.1, and EAA Annex I. These are legal and technical standards documents. If a rule's implementation diverges from its cited standard, it produces false audit results — false passes for non-conforming pages, or false failures for conforming ones. Both outcomes expose downstream users to legal risk (missed EAA compliance gaps, or unjustified remediation cost).

Three failure modes motivated explicit citation discipline:

1. A rule was implemented against a remembered paraphrase of a WCAG SC rather than the normative text — the paraphrase missed a normative exception, producing false failures on conforming ATM-interface patterns.
2. EN 301 549 and WCAG 2.2 are not always in 1:1 alignment — some EN clauses refine or restrict WCAG SCs for specific contexts (e.g., clause 7 for closed functionality, clause 11 for software). Citing only WCAG SC without the EN clause leaves the rule's scope ambiguous.
3. EAA Annex I §I.1–§I.6 maps product/service categories to applicable standards clauses. Rules targeting banking, checkout, or statement flows need to cite the specific Annex I subsection to clarify which product category the rule applies to.

## Decision

Every rule file in `packages/wcag-rules-extended/src/rules/**/*.ts` carries a `HELP_URL` constant pointing to the rule's documentation stub at `packages/wcag-rules-extended/docs/rules/<rule-name>.md`. Every documentation stub must include a **Standards mapping** section with:

- `WCAG 2.2 SC:` — the normative Success Criterion number, level (A / AA / AAA), and short name (e.g., «3.3.2 Labels or Instructions (Level A)»).
- `EN 301 549 v3.2.1 clause:` — the applicable clause number and title (e.g., «9.3.3.2 Labels or Instructions»). For rules derived from non-web EN clauses (e.g., clause 5 generic requirements, clause 7 closed functionality), the clause must be explicitly noted.
- `EAA Annex I:` — the applicable subsection of Directive (EU) 2019/882 EAA Annex I (e.g., «§I.3 e-commerce services» or «§I.2 banking services»). If the rule applies across all EAA product/service categories, note «General — all Annex I categories».
- `Impact level:` — one of: `critical` (blocks access entirely), `serious` (significant barrier), `moderate` (meaningful barrier for some users), `minor` (cosmetic / edge-case).

The `METHODOLOGY.md` document (`packages/wcag-rules-extended/docs/METHODOLOGY.md`) is the authoritative description of how WCAG SCs are translated into deterministic boolean checks and how citations are verified.

Human reviewer protocol: before each rule commit, the reviewer reads the normative WCAG SC text (https://www.w3.org/TR/WCAG22/) and the corresponding EN 301 549 clause (ETSI EN 301 549 v3.2.1 PDF, free download from ETSI portal), verifies the rule's check logic matches the normative requirement, and approves the `git diff` before push.

## Consequences

- **Positive:** per-rule traceability to primary standards documents; auditable by procurement reviewers, NLnet evaluators, and accessibility auditors; false-positive and false-negative rates are accountable against normative text rather than paraphrase.
- **Negative:** each new rule requires the developer to read primary standards documents (WCAG 2.2, EN 301 549 v3.2.1 PDF) before implementation — this is deliberate friction, not overhead to be eliminated. It is the floor of rule quality.
- **Neutral:** standards documents are freely available. EN 301 549 v3.2.1 is downloadable from ETSI without payment or registration. WCAG 2.2 is published under W3C Document License.

## Alternatives considered

- Self-referential citations (citing only the rule's own documentation): tautological — does not anchor the rule to a primary normative source.
- Citing only WCAG 2.2 without EN 301 549: insufficient for EAA applicability — EN 301 549 is the harmonised standard cited in EAA enforcement decisions; WCAG 2.2 is the underlying technical specification.
- Automated citation checking: not implemented at Stage-1; the human reviewer protocol is the primary gate. Automated citation verification (crawling WCAG 2.2 API + EN 301 549 machine-readable form) is a Stage-2 roadmap item.

## References

- WCAG 2.2 Recommendation: https://www.w3.org/TR/WCAG22/
- EN 301 549 v3.2.1: https://www.etsi.org/deliver/etsi_en/301500_302000/301549/03.02.01_60/en_301549v030201p.pdf
- EAA Annex I: https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32019L0882
- `packages/wcag-rules-extended/docs/METHODOLOGY.md` — rule derivation methodology
- `packages/wcag-rules-extended/docs/rules/` — per-rule documentation stubs (Stage-1)
- `@ariada-org/regulatory-mappings` package — machine-readable WCAG SC → EN 301 549 → EAA Annex I mapping table
