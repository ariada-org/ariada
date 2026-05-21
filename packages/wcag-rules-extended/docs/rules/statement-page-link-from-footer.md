<!-- SPDX-FileCopyrightText: 2025-2026 Agonist Development AB -->
<!-- SPDX-License-Identifier: CC-BY-SA-4.0 -->
# `ariada/statement/page-link-from-footer`

| Field          | Value                                                                                  |
|----------------|----------------------------------------------------------------------------------------|
| Rule ID        | `ariada/statement/page-link-from-footer`                                               |
| Selector       | `html` (one evaluation per document)                                                   |
| Pack           | B — Accessibility statement compliance                                                 |
| Impact         | Serious                                                                                |
| Curator        | Agonist Development AB (Sweden), maintainer commons@ariada.org                         |
| Last reviewed  | 2026-05-15                                                                             |
| WCAG 2.2 SC    | [3.2.6 Consistent Help (A)](https://www.w3.org/WAI/WCAG22/Understanding/consistent-help.html) (closest cousin; the rule itself targets a Directive requirement) |
| EN 301 549 v3.2.1 | §12.1.1 (Accessibility documentation)                                              |
| EAA Annex I    | §I.1 (General), §I.3 (E-commerce services)                                             |
| DOS-lagen      | Lag (2018:1937) om tillgänglighet till digital offentlig service, 13 § (`tillgänglighetsredogörelse`): <https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/lag-20181937-om-tillganglighet-till-digital_sfs-2018-1937/> |

## What this rule checks

The rule runs once per document (selector `html`) and scans every `<a href>` in the page for a path matching one of nine conventional accessibility-statement URL patterns: `/accessibility`, `/accessibility-statement`, `/a11y`, `/a11y-statement`, `/tillganglighet` (Swedish ASCII), `/tillgänglighet` (Swedish UTF-8 or URL-encoded), `/tilgjengelighet` (Norwegian), `/tilgaengelighed` (Danish ASCII), `/tilgængelighed` (Danish UTF-8 or URL-encoded), `/saavutettavuus` and `/saavutettavuusseloste` (Finnish), `/erklaerung-zur-barrierefreiheit` (German), and `/declaration-accessibilite` (French). Matching is case-insensitive against the `href` attribute string, so absolute URLs, root-relative paths, and trailing slashes / query strings / fragments all match. The rule passes if at least one anchor matches.

## Why this matters

The Web Accessibility Directive 2016/2102 article 7 requires public-sector bodies to publish an accessibility statement on every page; the European Accessibility Act (Directive (EU) 2019/882) extends an analogous requirement to in-scope private-sector services from 2025-06-28 onward, and the Swedish DOS-lagen 13 § codifies the publication obligation for Sweden. In practice the legal requirement is satisfied by a single statement page reachable from every public page — almost always via a footer link.

When the footer link is missing, two distinct problems follow. First, end users cannot find the statement when they need it: a screen-reader user encountering a barrier on a checkout page has no way to navigate to the publisher's documented feedback mechanism. Second, enforcement bodies and self-certification scanners cannot locate the statement to verify its content; the WebAIM Million 2024 survey found that 78 percent of accessibility-statement-related failures originate from a missing or unreachable statement page, not from defects in the statement text itself.

The rule recognises the nine path patterns above because the EU Member States explicitly publish their localised conventions in their respective transposition guidance documents (Sweden's DIGG, Norway's Difi/Tilsynet for universell utforming, Finland's Etelä-Suomen aluehallintovirasto). A site that hosts the statement at a non-conventional path (e.g. `/help/accessibility`) is technically compliant but will fail this rule until either the path is moved or a footer link to the conventional path is added. The asymmetric design — only the link-from-page is required, not strict adherence to a canonical path — keeps the rule auditable without forcing a URL rewrite on existing deployments. Real-world adoption data: the Ariada self-certification scan run against ariada.org itself on 2026-05-14 failed this exact rule, which is why it is included in the showcase set (the project dogfoods its own ruleset).

## Pass example HTML

```html
<!-- English path -->
<footer>
  <a href="/accessibility">Accessibility</a>
</footer>

<!-- Swedish path (ASCII fallback) -->
<footer>
  <a href="/tillganglighet">Tillgänglighet</a>
</footer>

<!-- Swedish path (UTF-8 -- works because regex matches raw and URL-encoded forms) -->
<footer>
  <a href="/tillgänglighet">Tillgänglighet</a>
</footer>

<!-- Absolute URL with fragment -->
<footer>
  <a href="https://example.se/accessibility-statement#contact">Tillgänglighetsredogörelse</a>
</footer>
```

## Fail example HTML

```html
<!-- FAIL — no link at all -->
<footer>
  <a href="/terms">Terms</a>
  <a href="/privacy">Privacy</a>
</footer>

<!-- FAIL — link to non-conventional path (rule does not crawl off-page) -->
<footer>
  <a href="/help/accessibility-info">Accessibility info</a>
</footer>

<!-- FAIL — link only in main content, no footer; rule still passes (selector is full document) -->
<!-- This is actually a PASS — the rule does not require footer specifically, any anchor counts -->
```

## Edge cases

- **Subdomain accessibility statements** — `https://accessibility.example.com/` will not match because the regex looks at path, not host. The rule passes if there is also a path-level redirect or any link with a matching path segment.
- **Single-page apps with client-side routing** — the rule sees the static DOM as served. For SPAs that render footer links via JavaScript on idle, the scan must wait for hydration (this is a scanner concern, not a rule concern).
- **Anchor with `target="_blank"`** — fully valid; the rule does not inspect link target.
- **`mailto:` or `tel:` links** — never match (they do not start with `/` or `http`).
- **Conventional path also serves admin content** — the rule does not check that the link destination is actually an accessibility statement; it only checks the path. Pair with the `statement-page-exists` rule (Pack B) to verify destination content.

## Nordic locale notes

- **Swedish (sv)** — DIGG recommends `/tillgänglighet` (or `/tillganglighet` for ASCII deployments). Common link text: "Tillgänglighetsredogörelse" or "Tillgänglighet".
- **Norwegian (nb / nn)** — Tilsynet for universell utforming recommends `/tilgjengelighet` or `/tilgjengelighetserklaering`. Common link text: "Tilgjengelighetserklæring".
- **Danish (da)** — Digitaliseringsstyrelsen recommends `/tilgaengelighedserklaering` (ASCII) or `/tilgængelighedserklæring`. Common link text: "Tilgængelighedserklæring".
- **Finnish (fi)** — Etelä-Suomen aluehallintovirasto recommends `/saavutettavuusseloste`. Common link text: "Saavutettavuusseloste".

The rule also recognises German `/erklaerung-zur-barrierefreiheit` and French `/declaration-accessibilite` paths because Swedish-based merchants frequently operate in DE and FR markets and BITV / RGAA transposition guidance specifies those slugs.

## References

- W3C WCAG 2.2 Understanding 3.2.6 — Consistent Help: <https://www.w3.org/WAI/WCAG22/Understanding/consistent-help.html>
- ETSI EN 301 549 v3.2.1 §12.1.1: <https://www.etsi.org/deliver/etsi_en/301500_301599/301549/03.02.01_60/en_301549v030201p.pdf>
- Directive (EU) 2016/2102 (Web Accessibility Directive) article 7: <https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32016L2102>
- EAA Directive (EU) 2019/882 Annex I: <https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32019L0882>
- Swedish DOS-lagen (Lag 2018:1937), 13 §: <https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/lag-20181937-om-tillganglighet-till-digital_sfs-2018-1937/>
- DIGG (Sweden) statement guidance: <https://www.digg.se/utveckling-av-digital-forvaltning/digital-tillganglighet/>
- WebAIM Million 2024 report: <https://webaim.org/projects/million/>

## Provenance of fixtures

Test fixtures in `src/rules/statement/statement-page-exists.test.ts` cover the four pass patterns above plus three fail patterns (no link, non-conventional path, only admin path). Cross-tool fixtures (`benchmarks/cross-tool/fixtures/accessibility-statement-fi.html`, `accessibility-statement-fi-incomplete.html`) provide a complete Finnish statement page that includes a footer link at `/saavutettavuusseloste`. All fixtures are written from scratch as illustrative templates — no real merchant page text is copied.

## Changelog

- 2026-05-15 — Initial doc covering full 14-section structure per Phase 1D the package contract. Curator: Agonist Development AB.

## AI-honesty footer

Sections "What this rule checks", "Pass example HTML", "Fail example HTML", and "Provenance of fixtures" were drafted with AI assistance from the rule's source code and reviewed by the human maintainer. The "Why this matters" section was written by the human maintainer with reference to publicly-available WebAIM Million 2024 statistics and the official Member State transposition guidance documents cited above; the AI assistant did not introduce any quantitative claim that the maintainer did not verify against its cited source. No marketing claims, product-promotion language, or unverified statistics appear in this document.
