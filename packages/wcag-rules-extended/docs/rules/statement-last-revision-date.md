<!--
SPDX-FileCopyrightText: 2026 Alekszandr Bricskin (Agonist Development AB, Sweden, org.nr 559452-5726)
SPDX-License-Identifier: EUPL-1.2
-->

# statement-last-revision-date

**Rule ID:** `ariada/statement/last-revision-date`
**Pack:** statement
**WCAG SC:** 3.2.6 Consistent Help (Level A, WCAG 2.2)
**EN 301 549 v3.2.1:** §12.1.1
**EAA Annex I §:** I.1 (General accessibility statement requirements)
**Impact:** minor

## What this rule checks

The rule operates on accessibility-statement pages and verifies that a last-revision date (separate from publication date) is declared in machine-readable form. The preferred pattern is a `<time datetime="YYYY-MM-DD">` element near a heading or label matching `/last (updated|revised|review)|senast (uppdaterad|granskad)|viimeksi päivitetty|sidst opdateret|sist oppdatert/i`. A free-text "Updated recently" or "Reviewed 2024" without ISO date fails.

## Why this matters under EAA 2025

The accessibility-statement lifecycle assumes regular review — Commission Implementing Decision (EU) 2018/1523 §6 expects a "frequent" review cadence, with the precise interval set by the operator's accessibility policy. The last-revision date is how users (and supervisory authorities) verify the statement is current. A statement with publication date 2020 and no revision marker after EAA 2025 enters force is presumptively stale.

## Pass example

```html
<p>This statement was last reviewed on
   <time datetime="2026-04-12">12 April 2026</time>.</p>

<dl>
  <dt>Last updated</dt>
  <dd><time datetime="2026-05-01">2026-05-01</time></dd>
</dl>
```

## Fail example

```html
<p>This statement was last reviewed recently.</p>
<p>Statement updated 2024.</p>
```

## Implementation notes

The check first searches for `<time datetime="YYYY-MM-DD">` within 200 characters of a revision-label text matching the multi-locale regex above. As a fallback, it accepts an ISO-8601 date string (`YYYY-MM-DD`) in plain text within the same proximity window. Loose date formats (`Q2 2024`, `recently`, `Spring 2025`) are rejected.

## Related

- [Rule pack INDEX](./INDEX.md)
- Commission Implementing Decision (EU) 2018/1523 §6: <https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32018D1523>
- EN 301 549 v3.2.1 §12.1.1: <https://www.etsi.org/deliver/etsi_en/301500_301599/301549/03.02.01_60/en_301549v030201p.pdf>
- HTML Living Standard `<time>` element: <https://html.spec.whatwg.org/multipage/text-level-semantics.html#the-time-element>
