<!--
SPDX-FileCopyrightText: 2026 Alexander Brichkin (Agonist Development AB, Sweden, org.nr 559452-5726)
SPDX-License-Identifier: EUPL-1.2
-->

# transport-seat-selection-has-accessible-name

**Rule ID:** `ariada/transport/seat-selection-has-accessible-name`
**Pack:** transport
**WCAG SC:** 4.1.2 Name, Role, Value (Level A)
**EN 301 549 v3.2.1:** §9.4.1.2
**EAA Annex I §:** I.7 (Transport services)
**Impact:** serious

## What this rule checks

The rule inspects each seat control inside an interactive seat map (`data-seat-map`) and passes when it has an accessible name identifying its seat (for example "12A"). A seat control is a `<button>`, an element with `role="button"`, or an `<input>` whose type is `checkbox` or `radio`. A control with no name reads as a bare "button" with no seat identity, so a screen-reader traveller cannot tell which seat they are about to book.

The accessible name may come from the control's text content, an associated `<label>`, `aria-label`, `aria-labelledby`, or `title`. The `value` attribute is deliberately not accepted as a name source for a checkbox or radio input — accessibility mapping derives those controls' names from a label, not their value, so a `value="12A"` with no label is a genuine violation a screen-reader user would hit. A control inside a seat map with no accessible name fails. Any control outside an element marked `data-seat-map` is skipped.

## Why this matters under EAA 2025

The EAA (European Accessibility Act, Directive (EU) 2019/882) requires transport services (Annex I §I.7) to expose their interactive components with a name that assistive technology can read. A seat map can hold dozens of identical controls; without a per-seat name a screen-reader user hears an undistinguishable grid of "button" and cannot complete the booking. EN 301 549 v3.2.1 §9.4.1.2 is the harmonised-standard clause that echoes WCAG 4.1.2 (Name, Role, Value).

## Pass example

```html
<div data-seat-map>
  <button aria-label="Seat 12A, window">12A</button>
</div>
```

## Fail example

```html
<div data-seat-map>
  <button class="seat available"></button>
</div>
```

## Implementation notes

The match function returns true when the node is inside an element matching `[data-seat-map]` (via `closest`) and is a `<button>`, has `role="button"`, or is a checkbox or radio `<input>`. The check then asks the package's lightweight accessible-name helper for a name and passes when that name is non-empty. The helper resolves the standard sources — text content, associated label, `aria-label`, `aria-labelledby`, and `title`. The `value` attribute is intentionally not treated as a name source for checkbox and radio inputs, because accessibility mapping derives their names from a label rather than the value.

## Related

- [Rule pack INDEX](./INDEX.md)
- WCAG Understanding 4.1.2 Name, Role, Value: <https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html>
