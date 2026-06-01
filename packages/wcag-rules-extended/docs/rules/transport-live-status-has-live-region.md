<!--
SPDX-FileCopyrightText: 2026 Alexander Brichkin (Agonist Development AB, Sweden, org.nr 559452-5726)
SPDX-License-Identifier: EUPL-1.2
-->

# transport-live-status-has-live-region

**Rule ID:** `ariada/transport/live-status-has-live-region`
**Pack:** transport
**WCAG SC:** 4.1.3 Status Messages (Level AA)
**EN 301 549 v3.2.1:** §9.4.1.3
**EAA Annex I §:** I.7 (Transport services)
**Impact:** serious

## What this rule checks

The rule inspects each element carrying `data-live-status` — a departures board or delay notice that updates without a page reload — and passes when it is an ARIA live region. It is satisfied by EITHER `aria-live="polite"` or `aria-live="assertive"`, OR `role="status"` or `role="alert"`. Any of those makes the surface announce its updates to assistive technology. An element with neither fails, and `aria-live="off"` does not satisfy the check because it suppresses announcements.

Values are matched case-insensitively and trimmed. An element without the `data-live-status` attribute is skipped.

## Why this matters under EAA 2025

The EAA (European Accessibility Act, Directive (EU) 2019/882) requires transport services (Annex I §I.7) to convey status changes to all users. When a board flips a service to "Delayed" or "Cancelled" in place, a sighted traveller sees it immediately, but a screen-reader user is told nothing unless the surface is a live region. EN 301 549 v3.2.1 §9.4.1.3 is the harmonised-standard clause that echoes WCAG 4.1.3 (Status Messages).

## Pass example

```html
<div data-live-status aria-live="polite">
  Train 412 to Göteborg — departing on time, platform 5.
</div>
```

## Fail example

```html
<div data-live-status>
  Train 412 to Göteborg — delayed 20 minutes.
</div>
```

## Implementation notes

The match function returns true when the node has the `data-live-status` attribute. The check reads `aria-live`, trims and lower-cases it, and passes on `polite` or `assertive`. Otherwise it reads `role`, trims and lower-cases it, and passes on `status` or `alert`. The value `aria-live="off"` is deliberately not accepted, because it tells assistive technology not to announce changes. The rule checks the region declaration only; it does not verify that updates are actually written into the region at runtime.

## Related

- [Rule pack INDEX](./INDEX.md)
- WCAG Understanding 4.1.3 Status Messages: <https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html>
