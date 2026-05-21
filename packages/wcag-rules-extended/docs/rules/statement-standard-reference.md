<!--
SPDX-FileCopyrightText: 2026 Alekszandr Bricskin (Agonist Development AB, Sweden, org.nr 559452-5726)
SPDX-License-Identifier: EUPL-1.2
-->

# statement-standard-reference

**Rule ID:** `ariada/statement/standard-reference`
**Pack:** statement
**WCAG SC:** 3.2.6 Consistent Help (Level A, WCAG 2.2)
**EN 301 549 v3.2.1:** §12.1.1
**EAA Annex I §:** I.1 (General accessibility statement requirements)
**Impact:** minor

## What this rule checks

The rule operates on accessibility-statement pages and verifies the document explicitly references the standard that the conformance claim is made against. Acceptable references are: `WCAG 2.1 AA`, `WCAG 2.2 AA`, `EN 301 549 v3.2.1`, `EN 301 549 v3.2.x` (any 3.2 patch revision). A statement that says "complies with web accessibility standards" without naming the standard fails.

## Why this matters under EAA 2025

EU Member States transposing the EAA can choose between citing WCAG or the harmonised EN 301 549 — which one matters for legal interpretation. EN 301 549 inherits the WCAG success criteria but adds non-WCAG clauses (chapter 10 documentation, chapter 11 software, chapter 12 documentation including the accessibility statement itself). Without an explicit standard reference, the reader cannot tell which scope the operator is claiming conformance to. Commission Implementing Decision (EU) 2018/1523 model statement §1 expects an explicit reference.

## Pass example

```html
<section>
  <h2>Conformance status</h2>
  <p>
    This website is partially conformant with
    <strong>WCAG 2.2 level AA</strong>, as defined in
    <strong>EN 301 549 v3.2.1</strong>.
  </p>
</section>
```

## Fail example

```html
<section>
  <h2>Conformance status</h2>
  <p>We comply with web accessibility standards.</p>
</section>
```

## Implementation notes

The check applies a case-insensitive regex over the page body looking for at least one of: `WCAG 2.[012] (level )?(A|AA|AAA)`, `EN 301[ -]?549[ ]?v?3\.[12]\.[0-9]+`. At least one match must appear within the first 4 KB of visible body text.

## Related

- [Rule pack INDEX](./INDEX.md)
- W3C WCAG 2.2: <https://www.w3.org/TR/WCAG22/>
- ETSI EN 301 549 v3.2.1: <https://www.etsi.org/deliver/etsi_en/301500_301599/301549/03.02.01_60/en_301549v030201p.pdf>
- Commission Implementing Decision (EU) 2018/1523: <https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32018D1523>
