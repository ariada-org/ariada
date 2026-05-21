<!--
SPDX-FileCopyrightText: 2026 Alekszandr Bricskin (Agonist Development AB, Sweden, org.nr 559452-5726)
SPDX-License-Identifier: EUPL-1.2
-->

# checkout-cart-update-live-region

**Rule ID:** `ariada/checkout/cart-update-live-region`
**Pack:** checkout
**WCAG SC:** 4.1.3 Status Messages (Level AA)
**EN 301 549 v3.2.1:** §9.4.1.3
**EAA Annex I §:** I.3 (E-commerce services)
**Impact:** serious

## What this rule checks

The rule locates DOM elements that look like cart-summary regions (matched by `id`, `class`, `data-role`, or `data-testid` containing tokens such as `cart`, `basket`, `summary`, `total`) and verifies they declare a live-region attribute: `aria-live="polite"`, `aria-live="assertive"`, `role="status"`, or `role="alert"`. Static cart blocks that mutate via JavaScript (quantity change, line-item removal, total recalculation) without a live region fail because the change goes unannounced.

## Why this matters under EAA 2025

E-commerce checkout under EAA Annex I §I.3 frequently uses inline updates: a screen-reader user who removes an item from the cart, or who edits a quantity field, has no way to hear the new total unless the cart region announces. WCAG 4.1.3 (Status Messages) was added to WCAG 2.1 specifically for this pattern — status changes that do not move focus must be exposed via a live region. Without it, the user must navigate back into the cart structure to find the updated total, which is exhausting and error-prone.

## Pass example

```html
<aside id="cart-summary" aria-live="polite" aria-atomic="true">
  <h2>Cart</h2>
  <p>Subtotal: <span id="subtotal">199 kr</span></p>
  <p>Shipping: <span>49 kr</span></p>
  <p>Total: <strong id="total">248 kr</strong></p>
</aside>

<div role="status">
  <p>Items in cart: 3</p>
  <p>Cart total: 248 kr</p>
</div>
```

## Fail example

```html
<aside id="cart-summary">
  <h2>Cart</h2>
  <p>Total: <strong>248 kr</strong></p>
</aside>
```

## Implementation notes

The CSS selector is intentionally broad because axe-core's selector parser rejects the case-insensitive `i` flag. The runtime `matches` function applies a case-insensitive regex over `id`, `class`, `data-role`, and `data-testid` values. The check passes if the element OR any descendant carries `aria-live` (any value), `role="status"`, `role="alert"`, or `role="log"`.

## Related

- [Rule pack INDEX](./INDEX.md)
- WCAG Understanding 4.1.3: <https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html>
- WAI-ARIA Live Regions: <https://www.w3.org/TR/wai-aria-1.2/#live_region_roles>
- EN 301 549 v3.2.1: <https://www.etsi.org/deliver/etsi_en/301500_301599/301549/03.02.01_60/en_301549v030201p.pdf>
