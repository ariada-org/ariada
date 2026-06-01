<!--
SPDX-FileCopyrightText: 2026 Alexander Brichkin (Agonist Development AB, Sweden, org.nr 559452-5726)
SPDX-License-Identifier: EUPL-1.2
-->

# transport-fare-table-has-caption

**Rule ID:** `ariada/transport/fare-table-has-caption`
**Pack:** transport
**WCAG SC:** 1.3.1 Info and Relationships (Level A)
**EN 301 549 v3.2.1:** §9.1.3.1
**EAA Annex I §:** I.7 (Transport services)
**Impact:** moderate

## What this rule checks

The rule inspects each `<table data-fare-table>` — a price or fare matrix — and passes when it has a `<caption>` child whose text content is non-empty after trimming. The caption tells a screen-reader traveller what the grid of prices represents (for example "Single fares by zone") before they navigate into the cells. A fare table with no `<caption>`, or with an empty one, fails because the matrix of numbers has no announced context.

The rule only acts on a `<table>` element carrying the `data-fare-table` attribute; any other element is skipped.

## Why this matters under EAA 2025

The EAA (European Accessibility Act, Directive (EU) 2019/882) requires transport services (Annex I §I.7) to present their information so its structure and purpose are programmatically determinable. A fare table is a dense relational grid; entering it without a caption, a screen-reader user hears rows of numbers with no statement of what they price. The caption supplies that context up front. EN 301 549 v3.2.1 §9.1.3.1 is the harmonised-standard clause that echoes WCAG 1.3.1 (Info and Relationships).

## Pass example

```html
<table data-fare-table>
  <caption>Single fares by zone (SEK)</caption>
  <thead><tr><th scope="col">Zone</th><th scope="col">Adult</th></tr></thead>
  <tbody><tr><th scope="row">1</th><td>39</td></tr></tbody>
</table>
```

## Fail example

```html
<table data-fare-table>
  <thead><tr><th scope="col">Zone</th><th scope="col">Adult</th></tr></thead>
  <tbody><tr><th scope="row">1</th><td>39</td></tr></tbody>
</table>
```

## Implementation notes

The match function returns true when the node is a `<table>` and has the `data-fare-table` attribute. The check looks for `:scope > caption` — a `<caption>` that is a direct child of this table — so a caption belonging to a table nested inside a cell does not count. If no own caption exists it fails, and if one exists it passes only when the caption's trimmed text content has length greater than zero. The rule asks for a non-empty caption specifically, so an empty `<caption></caption>` does not satisfy it. Header-cell quality is out of scope here and is covered by the separate timetable header-cell rule pattern.

## Related

- [Rule pack INDEX](./INDEX.md)
- WCAG Understanding 1.3.1 Info and Relationships: <https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html>
