<!--
SPDX-FileCopyrightText: 2026 Alekszandr Bricskin (Agonist Development AB, Sweden, org.nr 559452-5726)
SPDX-License-Identifier: EUPL-1.2
-->

# banking-session-timeout-warning

**Rule ID:** `ariada/banking/session-timeout-warning`
**Pack:** banking
**WCAG SC:** 2.2.1 Timing Adjustable (Level A)
**EN 301 549 v3.2.1:** §9.2.2.1
**EAA Annex I §:** I.4 (Banking services)
**Impact:** serious

## What this rule checks

The rule locates session-timeout warning dialogs in the DOM — elements with `role="alertdialog"`, `role="dialog"`, or class/id matching `/(timeout|session.*(expir|warning)|logout.*warn)/i` — and verifies the dialog contains a focusable element offering to extend or continue the session. A bare countdown timer with no actionable control fails.

## Why this matters under EAA 2025

Banking session timeouts are mandatory under PSD2 strong-customer-authentication rules — sessions typically expire after 5-15 minutes of inactivity. For users with motor disabilities, cognitive disabilities, or those using assistive technology with high overhead, completing a transfer within that window can be tight. WCAG 2.2.1 (Timing Adjustable) requires users be able to extend, adjust, or turn off time limits with rare exceptions. EAA §I.4 inherits this requirement for all consumer-credit and payment-account interfaces. A timeout that fires without warning, or warns without an extend control, is a critical accessibility barrier.

## Pass example

```html
<div
  role="alertdialog"
  aria-labelledby="timeout-title"
  aria-describedby="timeout-msg"
>
  <h2 id="timeout-title">Session about to expire</h2>
  <p id="timeout-msg">Your session will end in 60 seconds.</p>
  <button>Extend session</button>
  <button>Sign out now</button>
</div>
```

## Fail example

```html
<div class="timeout-warning">
  <p>Your session will end in 60 seconds.</p>
</div>
```

## Implementation notes

The CSS selector is intentionally broad because axe-core's selector parser rejects the `i` flag. The runtime `matches` function applies case-insensitive regex narrowing. The check passes if the matched dialog contains a `<button>`, `<a>`, or element with `role="button"` whose accessible name contains "extend", "continue", "stay", "keep", "förläng", "fortsätt", or equivalent Nordic-locale verbs.

## Related

- [Rule pack INDEX](./INDEX.md)
- WCAG Understanding 2.2.1: <https://www.w3.org/WAI/WCAG22/Understanding/timing-adjustable.html>
- EN 301 549 v3.2.1: <https://www.etsi.org/deliver/etsi_en/301500_301599/301549/03.02.01_60/en_301549v030201p.pdf>
- PSD2 RTS on SCA: <https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32018R0389>
