<!--
SPDX-FileCopyrightText: 2026 Alekszandr Bricskin (Agonist Development AB, Sweden, org.nr 559452-5726)
SPDX-License-Identifier: EUPL-1.2
-->

# statement-publication-date-present

**Rule ID:** `ariada/statement/publication-date-present`
**Pack:** statement
**WCAG SC:** 3.2.6 Consistent Help (Level A, WCAG 2.2)
**EN 301 549 v3.2.1:** §12.1.1
**EAA Annex I §:** I.1 (General accessibility statement requirements)
**Impact:** moderate

## What this rule checks

The rule operates on accessibility-statement pages and verifies the publication date is declared in machine-readable form using a `<time datetime="YYYY-MM-DD">` element near a label matching `/published|publicerad|julkaistu|udgivet|publisert/i`. Free-text dates (`January 2024`, `Spring 2025`) without an ISO-8601 `datetime` attribute fail.

## Why this matters under EAA 2025

The publication date is the first temporal anchor in an accessibility statement — it tells the reader when the operator's compliance position was first declared. Commission Implementing Decision (EU) 2018/1523 §5 lists publication date as a mandatory element. The pair (publication date, last-revision date) lets supervisory authorities track statement freshness. A machine-readable `<time>` element matters because RSS aggregators, search-engine snippet displays, and accessibility-statement registries all extract the date programmatically.

## Pass example

```html
<p>
  This statement was first published on
  <time datetime="2026-01-15">15 January 2026</time>.
</p>

<dl>
  <dt>Date of publication</dt>
  <dd><time datetime="2026-01-15">2026-01-15</time></dd>
</dl>
```

## Fail example

```html
<p>This statement was first published in January 2026.</p>
<p>Published: Spring 2026.</p>
```

## Implementation notes

The check searches for `<time datetime="YYYY-MM-DD">` within 200 characters of a publication-label text matching the multi-locale regex above. As a fallback, it accepts an ISO-8601 date in plain text within the same proximity window. The publication date must be earlier than or equal to the last-revision date detected by the sister rule (sanity check; reports inconsistency as a separate sub-finding).

## Related

- [Rule pack INDEX](./INDEX.md)
- Commission Implementing Decision (EU) 2018/1523 §5: <https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32018D1523>
- HTML Living Standard `<time>` element: <https://html.spec.whatwg.org/multipage/text-level-semantics.html#the-time-element>
- EN 301 549 v3.2.1 §12.1.1: <https://www.etsi.org/deliver/etsi_en/301500_301599/301549/03.02.01_60/en_301549v030201p.pdf>
