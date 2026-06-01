<!--
SPDX-FileCopyrightText: 2026 Alexander Brichkin (Agonist Development AB, Sweden, org.nr 559452-5726)
SPDX-License-Identifier: EUPL-1.2
-->

# transport-timetable-has-header-cells

**Rule ID:** `ariada/transport/timetable-has-header-cells`
**Pack:** transport
**WCAG SC:** 1.3.1 Info and Relationships (Level A)
**EN 301 549 v3.2.1:** §9.1.3.1
**EAA Annex I §:** I.7 (Transport services)
**Impact:** serious

## What this rule checks

The rule inspects each `<table data-timetable>` — a departures or arrivals grid — and passes when the table owns at least one `<th>` header cell. The `<th>` may sit in a `<thead>`, may be a row header with `scope="row"`, or may appear inside the body; any single header cell that belongs to this table satisfies the check, but a `<th>` inside a table nested in a body cell does not. A timetable made entirely of `<td>` cells, or an empty timetable, fails.

The rule only acts on a `<table>` element carrying the `data-timetable` attribute. A plain table without that attribute is skipped, and a non-table element carrying the attribute is skipped too.

## Why this matters under EAA 2025

The EAA (European Accessibility Act, Directive (EU) 2019/882) requires transport services (Annex I §I.7) to present information so its structure is programmatically determinable. A timetable is a relational grid: the meaning of "10:05" depends on whether it sits under a departure-time column. Without header cells a screen reader announces every value as an undifferentiated data cell, so a traveller cannot tell which column is the time, which is the platform, and which is the destination. EN 301 549 v3.2.1 §9.1.3.1 is the harmonised-standard clause that echoes WCAG 1.3.1 (Info and Relationships).

## Pass example

```html
<table data-timetable>
  <thead><tr><th scope="col">Depart</th><th scope="col">Platform</th></tr></thead>
  <tbody><tr><td>10:05</td><td>3</td></tr></tbody>
</table>
```

## Fail example

```html
<table data-timetable>
  <tbody>
    <tr><td>Depart</td><td>Platform</td></tr>
    <tr><td>10:05</td><td>3</td></tr>
  </tbody>
</table>
```

## Implementation notes

The match function returns true only when the node is a `<table>` and has the `data-timetable` attribute. The check then looks for a `<th>` that this table owns — a header cell whose nearest ancestor `<table>` is the timetable itself — so a `<th>` belonging to a table nested inside a body cell does not count. The header may sit in a `<thead>`, may be a row header with `scope="row"`, or may appear in the body, and any single owned header cell passes. The rule verifies only that header markup exists; it does not assess whether the headers are correctly scoped to their rows and columns, which is a separate concern.

## Related

- [Rule pack INDEX](./INDEX.md)
- WCAG Understanding 1.3.1 Info and Relationships: <https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html>
