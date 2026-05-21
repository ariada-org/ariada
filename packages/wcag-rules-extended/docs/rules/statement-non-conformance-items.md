<!-- SPDX-FileCopyrightText: 2025-2026 Agonist Development AB -->
<!-- SPDX-License-Identifier: CC-BY-SA-4.0 -->

# `ariada/statement/non-conformance-items-listed`

| Field             | Value                                                                                                          |
| ----------------- | -------------------------------------------------------------------------------------------------------------- |
| Rule ID           | `ariada/statement/non-conformance-items-listed`                                                                |
| Selector          | `html` (one evaluation per document; runs only on detected statement pages)                                    |
| Pack              | B — Accessibility statement compliance                                                                         |
| Impact            | Moderate                                                                                                       |
| Curator           | Agonist Development AB (Sweden), maintainer commons@ariada.ai                                                  |
| Last reviewed     | 2026-05-15                                                                                                     |
| WCAG 2.2 SC       | [3.2.6 Consistent Help (A)](https://www.w3.org/WAI/WCAG22/Understanding/consistent-help.html) (closest cousin) |
| EN 301 549 v3.2.1 | §12.1.1 (Accessibility documentation)                                                                          |
| EAA Annex I       | §I.1 (General — accessibility documentation accessible)                                                        |
| DOS-lagen         | Lag (2018:1937), 13 § + DIGG statement template article 4(b)                                                   |

## What this rule checks

The rule fires only on pages identified as accessibility-statement pages (via the shared `isStatementPage(doc)` helper which inspects URL path and page-text markers). If the statement declares "fully conformant" (or its Nordic equivalents `fullt förenlig`, `fullt samsvar`, `täysin yhdenmukai`) without any partial / non-conformant declaration, the rule passes by definition: a fully-conformant site has no known issues to enumerate. If the statement declares "partially conformant" or "non conformant" (including localised forms `delvis förenlig`, `inte förenlig`, `delvis samsvar`, `ikke samsvar`, `osittain yhdenmukai`, `ei yhdenmukai`), the rule then requires (a) at least one `<ul>` or `<ol>` containing one or more `<li>` items, AND (b) at least one WCAG Success Criterion reference somewhere in the document body — matched by the pattern `WCAG <n>.<n>(.<n>)?` or `SC <n>.<n>` or a bare `<n>.<n>.<n>` numeric triplet. The rule is intentionally lenient: it does not enforce the list-item count against the number of issues declared elsewhere; it only enforces that an enumeration exists.

## Why this matters

Article 7(1)(a)(ii) of Directive 2016/2102 requires the accessibility statement to specify "those parts of the content of the website or mobile application that are not in compliance with the requirements ... and the reasons for such non-compliance". The EAA mirrors this for in-scope private-sector services via Annex I §I.1 and the Member State transpositions (DOS-lagen 13 § in Sweden, ATAG transposition in Norway, saavutettavuuslaki 8 § in Finland). The text of the statement therefore must enumerate concrete non-conformances — not merely state that some exist.

A statement that admits partial conformance but provides no enumeration is the most common failure mode found by enforcement bodies. The Swedish DIGG enforcement report 2023 (published 2024-04-10) found that 41 percent of audited statements declared partial conformance without listing any specific known issues; 27 percent listed issues but without WCAG SC references that would let a screen-reader user judge whether the unfixed issues affect them. Both failure modes are detected by this rule, which is why the rule additionally requires at least one WCAG SC numeric reference rather than only requiring a list.

The asymmetric treatment — strict on partial / non-conformant, permissive on fully conformant — matches the legal asymmetry. A statement claiming full conformance is making a positive claim that, if false, exposes the publisher to enforcement penalties (sanction-eligible misrepresentation under DOS-lagen 18 §; civil-penalty-eligible under the EAA member-state transpositions). The scanner does not contest the truth of a "fully conformant" claim — that is for an audit — but it does enforce that any partial admission be backed by enumeration.

## Pass example HTML

```html
<!-- Fully conformant — rule passes without requiring a list -->
<main>
  <h1>Tillgänglighetsredogörelse</h1>
  <p>Webbplatsen är <strong>fullt förenlig</strong> med WCAG 2.2 AA.</p>
</main>

<!-- Partially conformant WITH enumeration AND WCAG SC reference -->
<main>
  <h1>Accessibility statement</h1>
  <p>
    This site is <strong>partially conformant</strong> with WCAG 2.2 level AA.
  </p>
  <h2>Known issues</h2>
  <ul>
    <li>
      Some image-only buttons in the merchant dashboard lack alt text (WCAG SC
      1.1.1).
    </li>
    <li>
      The session-timeout dialog announces with insufficient warning (WCAG
      2.2.1).
    </li>
    <li>
      One legacy PDF report is not tagged for screen readers (criterion 1.3.1).
    </li>
  </ul>
</main>
```

## Fail example HTML

```html
<!-- FAIL — partial conformance declared, no list at all -->
<main>
  <h1>Accessibility statement</h1>
  <p>This site is partially conformant with WCAG 2.2.</p>
  <p>We are working on it.</p>
</main>

<!-- FAIL — partial conformance + list but no WCAG SC reference -->
<main>
  <h1>Accessibility statement</h1>
  <p>This site is partially conformant.</p>
  <ul>
    <li>Some images need alt text.</li>
    <li>The search box has issues.</li>
  </ul>
</main>

<!-- FAIL — Nordic partial declaration without enumeration -->
<main>
  <h1>Tillgänglighetsredogörelse</h1>
  <p>Webbplatsen är delvis förenlig med WCAG 2.2 AA.</p>
</main>
```

## Edge cases

- **Conformance level not declared at all** — the rule passes (other rules in Pack B — specifically `statement-conformance-level` — flag the missing declaration). This rule's scope is limited to verifying that _if_ a partial declaration is made, _then_ enumeration follows.
- **"Partially" mention in unrelated context** — e.g., "this PDF is partially translated" anywhere on the page. The regex `\b(partial|non[\s-]?conformant)` requires the prefix `partial` followed by word characters, but a stray "partially" sentence will still match. Reducing this false-positive without losing Nordic equivalents is on the roadmap for v0.2.x.
- **WCAG SC reference inside a code block** — counts. The regex is content-agnostic.
- **Non-statement pages** — the rule short-circuits via `isStatementPage()` and never evaluates the rest. If the helper misclassifies a page (e.g., a blog post titled "Accessibility statement template tutorial"), the rule may run incorrectly; correcting `isStatementPage` is the right fix.
- **Multiple lists, none containing SC reference** — the rule requires the SC reference to appear _somewhere_ in body text, not necessarily inside a list item. This is intentional: many publishers list issues by topic and reference the SC in a preceding sentence.

## Nordic locale notes

The localised partial-conformance phrases recognised by the rule:

- **Swedish:** `delvis förenlig`, `inte förenlig`. Full form: `fullt förenlig`.
- **Norwegian:** `delvis samsvar`, `ikke samsvar`. Full form: `fullt samsvar`.
- **Finnish:** `osittain yhdenmukai...`, `ei yhdenmukai...`. Full form: `täysin yhdenmukai...`. (The `...` is the truncated word boundary — Finnish suffixes follow.)
- **Danish:** the rule recognises English-language "partially conformant" in Danish-language pages because the Danish transposition (Bekendtgørelse om webtilgængelighed) does not lock the exact wording. Localised Danish forms `delvist i overensstemmelse` are on the roadmap for v0.2.x.

The WCAG SC pattern `\d\.\d\.\d` is locale-neutral; the SC numbers are the same in all languages.

## References

- W3C WCAG 2.2 Understanding 3.2.6 — Consistent Help: <https://www.w3.org/WAI/WCAG22/Understanding/consistent-help.html>
- ETSI EN 301 549 v3.2.1 §12.1.1: <https://www.etsi.org/deliver/etsi_en/301500_301599/301549/03.02.01_60/en_301549v030201p.pdf>
- Directive (EU) 2016/2102 article 7(1)(a)(ii): <https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32016L2102>
- EAA Directive (EU) 2019/882 Annex I §I.1: <https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32019L0882>
- Swedish DOS-lagen 13 §: <https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/lag-20181937-om-tillganglighet-till-digital_sfs-2018-1937/>
- DIGG statement template (Swedish public-sector): <https://www.digg.se/kunskap-och-stod/digital-tillganglighet/skapa-en-tillganglighetsredogorelse>
- WebAIM Million 2024 report: <https://webaim.org/projects/million/>

## Provenance of fixtures

Test fixtures in `src/rules/statement/statement-non-conformance-items.test.ts` cover the pass and fail patterns above, plus the Nordic-language partial declarations (sv, nb, fi). Cross-tool fixtures (`benchmarks/cross-tool/fixtures/accessibility-statement-fi.html`, `accessibility-statement-fi-incomplete.html`) provide complete Finnish statement pages — one with full enumeration including SC references and one missing the enumeration — written from scratch using only the structural conventions documented in the Finnish AVI guidance.

## Changelog

- 2026-05-15 — Initial doc covering full 14-section structure per Phase 1D PRD §1.2. Curator: Agonist Development AB.

## AI-honesty footer

Sections "What this rule checks", "Pass example HTML", "Fail example HTML", and "Provenance of fixtures" were drafted with AI assistance from the rule's source code and reviewed by the human maintainer. The "Why this matters" section was written by the human maintainer with reference to the DIGG 2023 enforcement report and the cited EU and Member State legal texts; the AI assistant did not introduce any quantitative claim that the maintainer did not verify against its cited source. No marketing claims, product-promotion language, or unverified statistics appear in this document.
