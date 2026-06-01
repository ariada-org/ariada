<!--
SPDX-FileCopyrightText: 2026 Alexander Brichkin (Agonist Development AB, Sweden, org.nr 559452-5726)
SPDX-License-Identifier: EUPL-1.2
-->

# transport-booking-timeout-has-warning

**Rule ID:** `ariada/transport/booking-timeout-has-warning`
**Pack:** transport
**WCAG SC:** 2.2.1 Timing Adjustable (Level A)
**EN 301 549 v3.2.1:** §9.2.2.1
**EAA Annex I §:** I.7 (Transport services)
**Impact:** serious

## What this rule checks

The rule inspects each booking hold timer (a "your seats are held for N minutes" countdown) marked up with `data-booking-timeout` and passes when the traveller has a way to be warned about, and to extend, the time limit. It is satisfied by EITHER a `data-timeout-warning` attribute — the hook the application wires an "extend time" control to — OR an `aria-describedby` reference that resolves to at least one element with non-empty text describing the limit. A timer with neither fails: a user who needs more time loses their seats with no notice.

The rule only acts on an element carrying `data-booking-timeout`; any other element is skipped.

## Why this matters under EAA 2025

The EAA (European Accessibility Act, Directive (EU) 2019/882) requires transport services (Annex I §I.7) to let users adjust or extend time limits placed on a task. Seat-hold countdowns are common in ticketing flows, and people with cognitive, motor, or vision disabilities often need longer to read a seat map and complete payment. Without a warning or extension mechanism the booking silently expires. EN 301 549 v3.2.1 §9.2.2.1 is the harmonised-standard clause that echoes WCAG 2.2.1 (Timing Adjustable).

## Pass example

```html
<div data-booking-timeout aria-describedby="hold-note">
  Seats held: 09:48
</div>
<p id="hold-note">Your seats are held for 10 minutes. You can extend the time before it runs out.</p>
```

## Fail example

```html
<div data-booking-timeout>
  Seats held: 09:48
</div>
```

## Implementation notes

The match function returns true when the node has the `data-booking-timeout` attribute. The check passes immediately if the node also has a `data-timeout-warning` attribute. Otherwise it reads `aria-describedby`, splits the value on whitespace into ID tokens, resolves each via `getElementById`, and passes if any referenced element has non-empty trimmed text content. The rule verifies that a warning or extension mechanism is declared; it does not measure the length of the timeout or test that the extension control works.

## Related

- [Rule pack INDEX](./INDEX.md)
- WCAG Understanding 2.2.1 Timing Adjustable: <https://www.w3.org/WAI/WCAG22/Understanding/timing-adjustable.html>
