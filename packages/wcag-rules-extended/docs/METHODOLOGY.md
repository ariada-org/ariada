<!-- SPDX-FileCopyrightText: 2025-2026 Agonist Development AB -->
<!-- SPDX-License-Identifier: CC-BY-SA-4.0 -->
# Methodology — `@ariada-org/wcag-rules-extended`

This document describes how the 31 rules in this package were derived, what was deliberately excluded, what source standards and datasets informed each rule, and how the rule set is intended to evolve. It is the package's answer to the question "why these rules and not others?".

## 1. Scope and non-scope

This package is an **extension** to the [axe-core](https://github.com/dequelabs/axe-core) rule corpus. It deliberately does not duplicate any rule that axe-core already ships, and it does not attempt to be a complete accessibility scanner. Its scope is the subset of WCAG 2.2 AA Success Criteria for which:

1. The criterion is technology-detectable in static HTML (no browser instrumentation required for the basic check).
2. Detection is meaningfully sharper when the rule targets a specific **service flow** (checkout, statement page, banking 2FA) than when it is applied generically.
3. The European Accessibility Act 2019/882 Annex I or a national transposition (Swedish DOS-lagen, Norwegian universell utforming, Finnish saavutettavuuslaki) carries a sectoral requirement that maps to the criterion.

Out of scope:

- Visual contrast, focus indication, motion / animation — covered well by axe-core core rules.
- Mobile-app accessibility — different stack, different rule corpus.
- PDF and document accessibility — different stack, requires document parsing.
- WCAG 2.1 / 2.2 AAA criteria — out of EAA enforcement scope.
- WCAG 3.0 — not yet published as a stable W3C Recommendation.

## 2. Source standards corpus

Every rule cites a chain of authority from broad to narrow:

```
W3C WCAG 2.2 Success Criterion
       ↓ (auto-mapped via @ariada-org/regulatory-mappings table)
ETSI EN 301 549 v3.2.1 clause
       ↓ (legal pathway via Directive 2102 / 882)
EAA Annex I § sectoral mapping
       ↓ (Member State transposition)
National law (DOS-lagen / saavutettavuuslaki / forskrift om
              universell utforming / Bekendtgørelse om webtilg.)
```

The rule's `metadata` object declares the WCAG SC, EN 301 549 clause, and EAA Annex I section explicitly. The further national-law reference is documented in the per-rule markdown when applicable; it is not encoded in the rule object itself to avoid noise when running the rule against pages outside the jurisdictions covered.

Primary documents used as authority:

- **WCAG 2.2** (W3C Recommendation, 2023-10-05): <https://www.w3.org/TR/WCAG22/>
- **WCAG 2.2 Understanding** (W3C Working Note, normative for examples): <https://www.w3.org/WAI/WCAG22/Understanding/>
- **EN 301 549 v3.2.1** (2021-03), the EU-harmonised standard referenced by the EAA: <https://www.etsi.org/deliver/etsi_en/301500_301599/301549/03.02.01_60/en_301549v030201p.pdf>
- **Directive (EU) 2019/882** (European Accessibility Act): <https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32019L0882>
- **Directive (EU) 2016/2102** (Web Accessibility Directive for public-sector bodies): <https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32016L2102>
- **DOS-lagen** — Lag (2018:1937) om tillgänglighet till digital offentlig service: <https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/lag-20181937-om-tillganglighet-till-digital_sfs-2018-1937/>

## 3. Empirical inputs that shaped rule selection

Three empirical sources informed which axe-extension rules were selected for the package's first three packs:

### 3.1 WebAIM Million

The annual [WebAIM Million](https://webaim.org/projects/million/) report scans the top million home pages and reports the most-common detectable WCAG failures. The 2024 report ranks low contrast, missing alt text, empty links, missing form labels, and empty buttons as the top five failure modes — all of which are already covered by axe-core. Reading further into the report, the next tier of failures (missing or invalid `lang` attribute, missing form-input labels in checkout contexts, missing live-region announcements) is what motivated Pack A and the `lang-matches-locale` rule in Pack C. The WebAIM report does not break out accessibility-statement defects, which is why those required separate empirical input (see 3.3).

### 3.2 axe-core's published rule list

The full axe-core rule list (4.10 / 4.11 series) was reviewed clause-by-clause against EN 301 549 and the EAA Annex I sectors. Rules already covered upstream were excluded from this package. The gaps that remained — service-flow rules targeting checkout, statement, and banking — became the three rule packs in this package.

### 3.3 DIGG (Sweden) enforcement reports

The Swedish DIGG publishes annual enforcement reports describing the most-common accessibility-statement defects found during public-sector audits. The 2023 report (published 2024-04-10) found that statement-page absence, missing publication date, missing conformance-level declaration, partial-conformance without enumeration, missing feedback mechanism, and missing enforcement-procedure link together accounted for 73 percent of all audit findings. The ten rules in Pack B map directly to that report's audit categories, with the addition of two rules (`last-revision-date` and `methodology-disclosed`) that became required by the 2025 DIGG template update.

### 3.4 Ariada self-certification scan against `ariada.org`

In May 2026 the package was used to scan the project's own marketing site, `ariada.org`. The scan surfaced concrete gaps that motivated `statement/page-link-from-footer` (the project's site was failing it at the time of the scan) and `banking/lang-matches-locale` (which produced a false-positive on a multi-language page, leading to the documented v0.2.x roadmap fix for nested `lang` attributes). The self-cert run is documented in `benchmarks/cross-tool/output/REPORT.md`.

## 4. Detection technology

All rules in this package run **on raw HTML in a headless DOM** — specifically, against [happy-dom](https://github.com/capricorn86/happy-dom). No rule requires browser instrumentation, no rule requires the CDP Accessibility tree, and no rule requires a layout engine. This is a deliberate design decision so that the rules can run in three places: (a) inside the axe-core in-browser engine, (b) inside a Node.js test runner against fixture HTML, and (c) inside a server-side CI tool that scans pre-rendered HTML.

The cost of this decision is that rules that would benefit from browser instrumentation (e.g., focus-not-obscured, focus-appearance, contrast against a computed colour value) are not in scope for this package and are deferred to the parent Ariada scanner. The benefit is determinism: a rule that fails in the test suite will fail identically in production.

## 5. Heuristic discipline

Several rules use word-list or regex heuristics rather than pure structural matching. Examples include the language detector (`lang-matches-locale`), the partial-conformance detector (`non-conformance-items-listed`), and the payment-method name detector (`payment-fieldset-grouping`). For each heuristic the rule's source file documents the following:

- The exact word list, regex, or pattern in use.
- A pre-release test corpus on which the heuristic was tuned (size, source, labelling notes).
- The known false-positive and false-negative cases, and what the threshold trades off.
- The roadmap item for replacing the heuristic with a more precise mechanism when feasible.

Heuristics are not banned but they are visible: every heuristic that fires can be inspected by reading the rule source file, and the test suite includes fixtures exercising the edges.

## 6. Localisation

Pack C rules are explicitly Nordic-aware (sv, nb, da, fi). Pack A and Pack B rules are language-neutral where possible; where Nordic phrases must be recognised (e.g., `delvis förenlig`, `tillgänglighetsredogörelse`), they are listed alongside the English forms in the rule source. The package does not currently include German, French, Spanish, or other EU-language rules, but the rule structure is uniform enough that contributors can add them without architectural change.

A separate `payment-fieldset-grouping.locale.ts` file pattern exists in the checkout pack and is the template for future locale-extension files: locale-specific word lists, name patterns, and validation messages are kept in `.locale.ts` siblings to the rule definition so that the rule itself stays small and the locale tables can be reviewed independently.

## 7. License and IP discipline

The package is licensed [EUPL-1.2](../LICENSE). The rationale and the alternatives considered are documented in [adrs/0001-license-eupl-1.2.md](adrs/0001-license-eupl-1.2.md). WCAG rule expressions are W3C-published technical standards and we view their implementation as Commons work. This package implements only those standards-based rule expressions; it neither implements nor requires any of Agonist Development AB's separately-held proprietary technology.

## 8. Contribution model

New rules are accepted into the package when they meet six criteria:

1. The rule maps to a published WCAG SC, EN 301 549 clause, OR EAA Annex I requirement (preferably all three).
2. The rule can be evaluated against happy-dom without browser instrumentation.
3. The rule has a fixture-based test suite covering at least one pass and three fail patterns.
4. The rule does not duplicate any axe-core rule unless it is meaningfully sharper for a specific service flow.
5. The rule's heuristics (if any) are documented per section 5 above.
6. The contributor has signed off on the EUPL-1.2 license terms via DCO sign-off on every commit.

The package does not accept rules that re-implement features of the proprietary Ariada scanner (see the IP negative list). Contributors uncertain whether a proposed rule crosses the boundary should open a discussion issue before submitting a PR.

## 9. Versioning and changelog

The package follows semver. Breaking changes to rule semantics — including changes to which input HTML produces a pass vs fail — are major-version changes. Adding new rules or adding new fail patterns to an existing rule (where previously-passing HTML now fails) is a minor-version change. Bug fixes that restore the documented intended behaviour are patch-version changes. The CHANGELOG.md file records all changes back to the v0.1.0-pre release.

## 10. What's deliberately not here

A reader inspecting this package may notice the absence of certain things that other accessibility tools include. These omissions are intentional:

- **No AI / LLM-based rules.** All 31 rules are deterministic regex / DOM-traversal logic. AI-based rules belong in the parent Ariada scanner where they can carry their patent bindings; they do not belong in a Commons rule library.
- **No JS-overlay remediation suggestions.** Some commercial tools propose JavaScript "fixes" that paper over the underlying HTML defects. We view this as legally-defensive rather than engineering-valid; remediation belongs in source code, not in runtime overlays.
- **No site crawling.** This package is a rule library, not a scanner. A site crawler (such as [crawlee](https://github.com/apify/crawlee)) is a separate tool that calls this rule library on each page it discovers.
- **No CI-platform integration.** GitHub Actions, GitLab CI, and Azure DevOps integration belongs in the parent project's actions, not in the rule library. The rules are pure functions returning booleans; how they are invoked is the caller's choice.

## References

- W3C WCAG 2.2: <https://www.w3.org/TR/WCAG22/>
- W3C WCAG 2.2 Understanding: <https://www.w3.org/WAI/WCAG22/Understanding/>
- ETSI EN 301 549 v3.2.1: <https://www.etsi.org/deliver/etsi_en/301500_301599/301549/03.02.01_60/en_301549v030201p.pdf>
- Directive (EU) 2019/882 (EAA): <https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32019L0882>
- Directive (EU) 2016/2102 (Web Accessibility Directive): <https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32016L2102>
- DOS-lagen 2018:1937: <https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/lag-20181937-om-tillganglighet-till-digital_sfs-2018-1937/>
- DIGG accessibility statement guidance: <https://www.digg.se/utveckling-av-digital-forvaltning/digital-tillganglighet/>
- WebAIM Million 2024: <https://webaim.org/projects/million/>
- axe-core repository: <https://github.com/dequelabs/axe-core>

## Update

- Author: Agonist Development AB (Sweden, org.nr 559452-5726)
- Date: 2026-05-15
- Status: Active — describes the methodology used through v0.1.0
