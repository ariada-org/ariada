<!--
SPDX-FileCopyrightText: 2026 Agonist Development AB
SPDX-License-Identifier: EUPL-1.2
-->

# Rule Derivation Methodology

**Package:** `@ariada-org/wcag-rules-extended`
**Author:** Alexander Brichkin (Agonist Development AB)
**Status:** Stage-1 (NLnet cycle-13). Full methodology paper targeting Q3 2026.

This document describes how Web Content Accessibility Guidelines (WCAG) 2.2 Success Criteria (SC) and EN 301 549 v3.2.1 clauses are translated into the deterministic boolean checks shipped in this package. It also covers AI assistance scope in rule derivation, the human reviewer protocol, and known limitations.

---

## 1. Overview

The rule pack extends [axe-core](https://github.com/dequelabs/axe-core) with WCAG 2.2 AA rules that are (a) specific to European e-commerce and banking flows, (b) machine-checkable against a synthetic DOM (happy-dom) without requiring browser instrumentation, and (c) mapped to EN 301 549 v3.2.1 clauses and EAA Annex I subsections for procurement-ready audit trails.

Three rule packs ship in v0.1:

| Pack        | Target context                                               | Rules    |
| ----------- | ------------------------------------------------------------ | -------- |
| `banking`   | Online banking, authentication, IBAN/account-number inputs   | 10 rules |
| `checkout`  | E-commerce checkout flows, form labels, error identification | 11 rules |
| `statement` | Accessibility statement content and structure                | 10 rules |

Each rule is a pure function: `check(element: Element): boolean`. Rules receive a DOM element (from happy-dom or a real browser DOM via axe-core's node serializer) and return `true` (conformant) or `false` (non-conformant). No network calls, no browser instrumentation, no side effects.

---

## 2. Primary standards documents

The following primary documents are the normative authority for every rule in this package. The human reviewer reads these documents directly — AI assistance is not used to summarise them in lieu of reading:

| Document                              | URL                                                                                         | Role                                                |
| ------------------------------------- | ------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| WCAG 2.2 Recommendation               | https://www.w3.org/TR/WCAG22/                                                               | Primary technical specification — normative SC text |
| WCAG 2.2 Understanding                | https://www.w3.org/WAI/WCAG22/Understanding/                                                | Non-normative SC interpretation and intent          |
| WCAG 2.2 Techniques                   | https://www.w3.org/WAI/WCAG22/Techniques/                                                   | Non-normative implementation examples               |
| ETSI EN 301 549 v3.2.1                | https://www.etsi.org/deliver/etsi_en/301500_302000/301549/03.02.01_60/en_301549v030201p.pdf | Harmonised standard cited in EAA enforcement        |
| EAA Annex I (Directive (EU) 2019/882) | https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32019L0882                        | Applicable product/service categories               |
| WAD (Directive (EU) 2016/2102)        | https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32016L2102                        | Web Accessibility Directive (public sector)         |
| Swedish DOS-lagen                     | https://www.digg.se/                                                                        | Swedish national implementation                     |

---

## 3. Rule selection process

Rule selection is human-directed. The pack scope (banking, checkout, statement) was chosen based on three empirical inputs:

**3.1 WebAIM Million report (2025 edition)**
The WebAIM Million (https://webaim.org/projects/million/) is an annual crawl of the top 1 million websites reporting the most common WCAG failures. The 2025 report shows the top five failure categories by page prevalence. Rules in this pack target failure categories that both (a) appear in the WebAIM Million top-10 and (b) are specific to checkout and banking flow DOM patterns not covered by axe-core's existing rule set.

**3.2 axe-core gap analysis**
The axe-core rule set (https://github.com/dequelabs/axe-core/blob/develop/doc/rule-descriptions.md) was reviewed for coverage gaps in: form-label association in checkout flows, IBAN input validation patterns, locale-specific currency formatting, and accessibility statement content requirements. Rules in this pack fill gaps not addressed by axe-core's existing 120+ rules.

**3.3 DIGG enforcement reports**
The Swedish Myndigheten för digital förvaltning (DIGG, the Digital Government Agency) publishes annual enforcement reports on DOS-lagen compliance. Banking and e-commerce checkout flows are consistently cited as high-failure-rate categories. These reports provide empirical grounding for the pack's domain focus.

---

## 4. Translation from SC to deterministic check

Each rule's implementation follows a four-step process:

**4.1 Normative text reading**
The human reviewer reads the exact normative text of the WCAG 2.2 SC (not a paraphrase, not a summary) and the corresponding EN 301 549 clause. The SC's normative exceptions (e.g., «unless the label or instruction is essential» in SC 3.3.2) are explicitly noted.

**4.2 Empirical failure mode identification**
Before writing any code, the human reviewer identifies 3–5 concrete HTML DOM patterns that the rule should fail, and 2–3 patterns that it should pass. These are documented as test fixtures in the rule's `__tests__/<rule-name>.test.ts` file. This step is the authoritative expression of the rule's behavioural contract.

**4.3 AI-assisted candidate generation**
Given the normative SC text, the EN 301 549 clause, and the fail/pass fixtures from step 4.2, Claude Code (Anthropic, claude-opus-4-7 via Claude Code CLI) generates a candidate boolean check implementation. The typical prompt form is: «derive a deterministic happy-dom check for SC 3.3.2 in the checkout-form-label-association context; the check must return false for [fail fixture 1], [fail fixture 2], [fail fixture 3]; return true for [pass fixture 1]; reject heuristics that require browser instrumentation or computedStyle; use the same helpers as the IBAN rule». AI-drafted share: approximately 70–85% per rule file.

**4.4 Human review and approval**
The human reviewer evaluates the AI's candidate against:

- The normative SC text (does the check match the normative requirement, including exceptions?)
- The empirical failure modes from step 4.2 (do the fixtures pass/fail as expected?)
- False-positive risk (does the check flag conformant pages that have valid reasons to deviate?)
- Heuristic discipline (no heuristics that require browser instrumentation, no word lists that are locale-fragile without explicit locale scope)

The reviewer accepts the candidate, rewrites heuristics that are too aggressive, or rejects the candidate and re-prompts. The `git diff` is read in full before each commit.

---

## 5. Heuristic discipline

Rules may use heuristics (approximate checks that are not perfectly accurate) when:

- The normative SC does not specify a single deterministic algorithm, and
- The heuristic produces a false-positive rate below 5% on the test corpus, and
- The heuristic's scope and limitations are documented in the rule's documentation stub.

Permitted heuristics:

- Visible word lists (e.g., «contains one of: IBAN, account number, kontonummer» to identify banking input fields). Word lists are documented per-rule and marked as locale-scoped.
- Label-association patterns (explicit `for`/`id`, `aria-labelledby`, implicit wrapping `<label>`) using the DOM API.
- ARIA role and property checks against the ARIA in HTML specification.

Prohibited heuristics:

- `getComputedStyle` calls (browser-instrumentation, not available in happy-dom without polyfill)
- Network requests of any kind
- Screenshot-based visual checks
- Word lists that span multiple languages without explicit locale scoping

---

## 6. AI assistance scope

This section mirrors the disclosure in `AI_USAGE.md` §«Scope of AI assistance» and the companion grant disclosure document, at the rule-implementation level.

| Artefact                                              | AI-drafted share | Human reviewer protocol                                                                                                                  |
| ----------------------------------------------------- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Rule implementation (`<rule-name>.ts`)                | 70–85%           | Reviewer reads normative SC text, verifies check logic matches SC normative requirement, approves `git diff` before commit               |
| Test fixtures (`<rule-name>.test.ts`)                 | 80–90%           | Reviewer authored the behavioural contract (which fixtures pass/fail) before generation; inspects each generated fixture for correctness |
| Rule documentation stub (`docs/rules/<rule-name>.md`) | 60–75%           | Reviewer verifies WCAG SC number, EN 301 549 clause, and EAA Annex I subsection against primary documents                                |
| `METHODOLOGY.md` (this document)                      | 70–80%           | Reviewer verifies accuracy of all cross-references and standards citations                                                               |

The AI was used as a code drafting tool under continuous human direction. The human's intellectual contribution is in: (a) the decision of which rules to implement, (b) the normative standards reading, (c) the behavioural contracts (fail/pass fixture set), (d) the acceptance or rejection of AI-generated candidates, and (e) final approval of every commit.

See ADR-0003 (`docs/adrs/0003-ai-assistance-protocol.md`) for the full AI assistance governance decision.

---

## 7. Human reviewer protocol (per-commit)

Before each commit touching rule source files or test files:

1. Run `pnpm test --filter @ariada-org/wcag-rules-extended` locally — all tests must pass.
2. Run `pnpm typecheck` — no type errors.
3. Read `git diff` in full — verify no heuristic violates the discipline in §5, no word list is unterminated, no external call present.
4. For any new or modified rule: read the normative WCAG SC text and verify the check logic matches.
5. For any new or modified test: verify each fixture matches the HTML pattern it claims to represent.
6. Run `pnpm lint` — no ESLint errors.
7. Commit with DCO sign-off (`git commit -s`) and Conventional Commits format.

---

## 8. Confidence levels

Rules are internally classified by confidence:

| Confidence level | Definition                                                                                                                                                     | Example                                                                                            |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| **High**         | The rule's check is a direct implementation of normative SC text with no heuristics; false-positive rate < 1% on the test corpus                               | `checkout-form-label-association` — explicit `for`/`id` association per SC 1.3.1 and 3.3.2         |
| **Medium**       | The rule uses one approved heuristic (e.g., a visible word list); false-positive rate 1–5% estimated                                                           | `banking-iban-input-format` — IBAN keyword heuristic scoped to Swedish and Finnish locale          |
| **Low**          | The rule implements a complex accessibility statement content check where «correctness» depends on the page author's intent; false-positive rate > 5% possible | `statement-conformance-level` — checks that conformance level is declared, not that it is truthful |

Confidence level is documented in each rule's documentation stub under §«Standards mapping».

---

## 9. Known limitations and false-positive cases

**9.1 Locale scope**
Word-list heuristics in the `banking` pack are currently scoped to Swedish (`sv`) and Finnish (`fi`) locale patterns. Using these rules on UK or US banking pages may produce false positives where the page uses valid local terminology not in the word list. Locale extension is a Stage-2 roadmap item.

**9.2 Dynamic content**
Rules run against a static DOM snapshot. Dynamically injected content (error messages added after form submission, live regions that update after user action) is not captured in the snapshot. The `cart-update-live-region` rule checks for the presence of a `[aria-live]` region, not whether it is used correctly at runtime.

**9.3 Accessibility statement content truthfulness**
Rules in the `statement` pack verify that required content sections are present (conformance level declared, date present, feedback mechanism linked) but cannot verify that the declared conformance level is truthful. A page claiming «WCAG 2.2 AA compliant» when it is not will pass `statement-conformance-level` because the rule checks structure, not accuracy.

**9.4 Shadow DOM**
Rules do not pierce Shadow DOM. Web components that encapsulate form controls inside Shadow DOM are not checked. This is a known false-negative risk for modern component-library-based pages.

**9.5 Pre-policy legacy commits**
Two commits (`a9f6291d`, `6c128483`, 2026-05-13) carry legacy `Co-Authored-By: Claude` trailers from before the AI assistance protocol (ADR-0003) was formalised. These are not rewritten; the limitation is documented in `AI_USAGE.md` §«Commitment».

---

## 10. What is deliberately not in this package

The following are out of scope for `@ariada-org/wcag-rules-extended` and will not be added:

- **AI / LLM detection rules** — checking whether page content was AI-generated is patent-territory (close to proprietary portfolio claims H and G). Not in OSS surface.
- **Overlay detection** — handled by the separate `@ariada-org/anti-overlay` package.
- **Site crawling** — the rules package checks single-page DOM snapshots. Multi-page crawl orchestration is in `@ariada-org/multi-domain`.
- **CI platform integration** — handled by the reusable GitHub Actions workflow `ariada-org/ariada/.github/workflows/eaa-audit.yml`.
- **WCAG Level AAA rules** — EAA requires Level AA only. AAA rules are not included to avoid scope creep.
- **Colour contrast** — already covered by axe-core's `color-contrast` rule. No duplication.

---

## 11. Update history

| Version | Date       | Author             | Change                                                                                                                                                                                           |
| ------- | ---------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| v0.1    | 2026-05-22 | Alexander Brichkin | Initial methodology document. Covers rule derivation process, AI assistance scope, heuristic discipline, confidence levels, known limitations, and out-of-scope items. Stage-1 (NLnet cycle-13). |
