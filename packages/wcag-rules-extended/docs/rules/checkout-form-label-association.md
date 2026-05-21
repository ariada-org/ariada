<!--
SPDX-FileCopyrightText: 2026 Alekszandr Bricskin (Agonist Development AB, Sweden, org.nr 559452-5726)
SPDX-License-Identifier: EUPL-1.2
-->

# checkout-form-label-association

**Rule ID:** `ariada/checkout/form-label-association`
**Pack:** checkout
**WCAG SC:** 1.3.1 Info and Relationships (Level A), 3.3.2 Labels or Instructions (Level A), 4.1.2 Name, Role, Value (Level A)
**EN 301 549 v3.2.1:** §9.1.3.1, §9.3.3.2, §9.4.1.2
**EAA Annex I §:** I.3 (E-commerce services)
**Impact:** critical

## What this rule checks

The rule examines every `<input>`, `<select>`, and `<textarea>` inside a checkout-flow context (matched by surrounding form id/class containing `checkout`, `payment`, `order`, `cart`, or by ancestor `<form action>` URL containing these tokens) and verifies the field has a programmatic label by ONE of the four canonical mechanisms: a `<label for="…">` reference, a wrapping `<label>` element, an `aria-label`, or an `aria-labelledby`. Inputs with only a visible placeholder, an adjacent `<span>`, or a CSS-generated label fail.

## Why this matters under EAA 2025

E-commerce checkout under EAA Annex I §I.3 is the highest-traffic form interaction on most retail sites. A missing programmatic label means screen readers announce "edit text, blank" with no indication of what to enter. Placeholders are not labels — they disappear once the user starts typing, leaving the user with no way to verify what field they are in. The combined WCAG hooks (1.3.1, 3.3.2, 4.1.2) make this one of the most-cited a11y failures in EU consumer-protection enforcement.

## Pass example

```html
<form action="/checkout/place-order">
  <label for="email"
    >Email
    <input id="email" type="email" />
  </label>

  <label
    >Name
    <input type="text" />
  </label>

  <input type="text" aria-label="Postal code" />

  <span id="city-label">City</span>
  <input type="text" aria-labelledby="city-label" />
</form>
```

## Fail example

```html
<form action="/checkout/place-order">
  <input type="email" placeholder="Email" />
  <input type="text" placeholder="Name" />
  <input type="text" placeholder="Postal code" />
</form>
```

## Implementation notes

The `matches` function walks ancestors looking for checkout-context signals (form id/class/action URL, surrounding heading text). The check resolves the accessible name per the W3C Accessible Name and Description Computation algorithm — it inspects `aria-labelledby`, `aria-label`, `<label for>`, wrapping `<label>`, `title`, and falls back to placeholder ONLY for backwards-compat tracking (still flags it as a failure). Placeholder is rejected as a primary label per WCAG Understanding 3.3.2.

## Related

- [Rule pack INDEX](./INDEX.md)
- WCAG Understanding 1.3.1: <https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html>
- WCAG Understanding 3.3.2: <https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions.html>
- WCAG Understanding 4.1.2: <https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html>
- W3C Accessible Name and Description Computation: <https://www.w3.org/TR/accname-1.2/>
