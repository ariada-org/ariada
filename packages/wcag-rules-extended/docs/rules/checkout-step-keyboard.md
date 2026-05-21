<!--
SPDX-FileCopyrightText: 2026 Alekszandr Bricskin (Agonist Development AB, Sweden, org.nr 559452-5726)
SPDX-License-Identifier: EUPL-1.2
-->

# checkout-step-keyboard

**Rule ID:** `ariada/checkout/step-keyboard-accessible`
**Pack:** checkout
**WCAG SC:** 2.1.1 Keyboard (Level A), 4.1.2 Name, Role, Value (Level A)
**EN 301 549 v3.2.1:** §9.2.1.1, §9.4.1.2
**EAA Annex I §:** I.3 (E-commerce services)
**Impact:** serious

## What this rule checks

The rule locates DOM elements that look like checkout step-indicator controls (matched by `class`, `id`, or `data-role` containing `step`, `stepper`, `breadcrumb`, `wizard`, `progress-nav`) and tests whether each step is keyboard-focusable when interactive. If a step has a click handler, cursor pointer style, or is implemented as a `<div>` or `<span>` rather than a native `<a>` or `<button>`, the rule requires `tabindex="0"` AND an explicit `role="link"` or `role="button"`. Non-native clickable step indicators with no keyboard hook fail.

## Why this matters under EAA 2025

Multi-step checkout flows under EAA §I.3 (Cart → Address → Payment → Review) commonly render the step indicator as a row of small chips or dots. When implementation uses `<div>` for each step plus a click handler, sighted-mouse users can click to jump back to a previous step — but keyboard-only users cannot reach the chips at all. WCAG 2.1.1 (Keyboard) requires that all functionality be available from a keyboard. WCAG 4.1.2 (Name, Role, Value) requires that custom widgets expose role and state programmatically. The two combined specify the `tabindex="0"` + `role` pattern this rule requires.

## Pass example

```html
<nav aria-label="Checkout steps">
  <ol>
    <li><a href="/checkout/cart">1. Cart</a></li>
    <li><a href="/checkout/address" aria-current="step">2. Address</a></li>
    <li><button type="button" disabled>3. Payment</button></li>
    <li><span aria-disabled="true">4. Review</span></li>
  </ol>
</nav>

<nav>
  <div tabindex="0" role="link" data-step="1">Cart</div>
  <div tabindex="0" role="link" data-step="2" aria-current="step">Address</div>
</nav>
```

## Fail example

```html
<nav>
  <div class="step" onclick="goto('cart')">Cart</div>
  <div class="step current" onclick="goto('address')">Address</div>
  <div class="step">Payment</div>
</nav>
```

## Implementation notes

The CSS selector is broad (`[class], [id], [data-role]`) because axe-core's selector parser rejects the case-insensitive `i` flag. The runtime `matches` function applies a case-insensitive regex. The check considers a step "clickable" if it has an `onclick` attribute, an inline event handler, or CSS `cursor: pointer`; in such cases it requires `tabindex="0"` plus a non-presentational `role`.

## Related

- [Rule pack INDEX](./INDEX.md)
- WCAG Understanding 2.1.1: <https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html>
- WCAG Understanding 4.1.2: <https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html>
- WAI-ARIA Authoring Practices, Wizard pattern: <https://www.w3.org/WAI/ARIA/apg/patterns/>
