<!--
SPDX-FileCopyrightText: 2026 Alekszandr Bricskin (Agonist Development AB, Sweden, org.nr 559452-5726)
SPDX-License-Identifier: EUPL-1.2
-->

# statement-conformance-level

**Rule ID:** `ariada/statement/conformance-level-declared`
**Pack:** statement
**WCAG SC:** 3.2.6 Consistent Help (Level A, WCAG 2.2)
**EN 301 549 v3.2.1:** §12.1.1
**EAA Annex I §:** I.1 (General accessibility statement requirements)
**Impact:** moderate

## What this rule checks

The rule operates at document level on pages identified as accessibility statements (URL path contains `/accessibility`, `/tillgänglighet`, `/saavutettavuus`, `/tilgjengelighet`, `/tilgaengelighed`, or the page heading matches the same set). It verifies that the document declares a conformance level explicitly using one of the three legally-recognised wordings under Directive (EU) 2016/2102: "fully conformant" (or locale equivalent), "partially conformant", or "non-conformant". A statement that simply says "we comply with WCAG" without a conformance-level qualifier fails.

## Why this matters under EAA 2025

EU Member States transposing Directive 2016/2102 (public sector) and Directive 2019/882 (private sector under EAA) require accessibility statements to declare conformance level using the three-tier vocabulary defined in Commission Implementing Decision (EU) 2018/1523. The vocabulary lets enforcement bodies (DIGG in Sweden, Difi in Norway, Digst in Denmark, AVI in Finland) categorise statements consistently. Without an explicit level, the statement is legally ambiguous.

## Pass example

```html
<main>
  <h1>Accessibility statement</h1>
  <p>
    This website is <strong>partially conformant</strong> with WCAG 2.2 level
    AA. The following content is not fully accessible: …
  </p>
</main>
```

## Fail example

```html
<main>
  <h1>Accessibility statement</h1>
  <p>We are committed to digital accessibility and comply with WCAG.</p>
</main>
```

## Implementation notes

The check applies a case-insensitive regex over the visible text of the page (excluding `<nav>`, `<header>`, `<footer>` boilerplate) looking for the trio: `fully conformant`/`fullt förenlig`/`täysin yhteensopiva`, `partially conformant`/`delvis förenlig`/`osittain yhteensopiva`, `non-conformant`/`ej förenlig`/`ei yhteensopiva`. At least one of the three must appear within 300 characters of a WCAG reference.

## Related

- [Rule pack INDEX](./INDEX.md)
- Directive (EU) 2016/2102 (public-sector web accessibility): <https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32016L2102>
- Commission Implementing Decision (EU) 2018/1523 (model accessibility statement): <https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32018D1523>
- EN 301 549 v3.2.1 §12.1.1: <https://www.etsi.org/deliver/etsi_en/301500_301599/301549/03.02.01_60/en_301549v030201p.pdf>
