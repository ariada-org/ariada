<!--
SPDX-FileCopyrightText: 2026 Alekszandr Bricskin (Agonist Development AB, Sweden, org.nr 559452-5726)
SPDX-License-Identifier: EUPL-1.2
-->

# checkout-cart-quantity-input-label

**Rule ID:** `ariada/checkout/cart-quantity-input-label`
**Pack:** checkout
**WCAG SC:** 3.3.2 Labels or Instructions (Level A), 1.3.1 Info and Relationships (Level A), 4.1.2 Name, Role, Value (Level A)
**EN 301 549 v3.2.1:** §9.3.3.2, §9.1.3.1, §9.4.1.2
**EAA Annex I §:** I.3 (E-commerce services)
**Impact:** moderate

## What this rule checks

The rule examines `<input type="number">` and `<input type="text">` elements that look like cart-line-item quantity fields (matched against `name`, `id`, `class`, or label text containing "qty", "quantity", "antal", "määrä"). For each match, the rule verifies the input carries a product-distinguishing accessible name — either an `aria-label` mentioning the product name, an `aria-labelledby` reference resolving to an element that includes the product name, or a wrapping label with a product-specific suffix. Bare "Quantity" labels (which are identical for every cart row) fail.

## Why this matters under EAA 2025

Multi-row cart pages are the canonical e-commerce listing under EAA §I.3. Screen-reader users navigating with the tab key hear a sequence of identical "Quantity, 1, edit text" announcements — they cannot tell which product each input controls without backtracking to the row heading. The accessible-name requirement is to disambiguate: "Quantity, T-shirt blue M, 1" instead of just "Quantity, 1". WCAG 4.1.2 (Name, Role, Value) and 3.3.2 (Labels or Instructions) both apply.

## Pass example

```html
<tr>
  <td>T-shirt, blue, M</td>
  <td>
    <label for="qty-12345"
      >Quantity, T-shirt blue M
      <input id="qty-12345" type="number" value="1" />
    </label>
  </td>
</tr>

<tr>
  <td id="prod-12346">Sneakers, white, 42</td>
  <td>
    <input type="number" value="1" aria-labelledby="prod-12346 qty-label" />
    <span id="qty-label">quantity</span>
  </td>
</tr>
```

## Fail example

```html
<tr>
  <td>T-shirt, blue, M</td>
  <td>
    <label for="qty"
      >Quantity
      <input id="qty" type="number" value="1" />
    </label>
  </td>
</tr>
```

## Implementation notes

The `matches` function uses a case-insensitive regex to identify quantity-input candidates. The check examines the computed accessible name (per the accname spec) and passes when the name contains at least one token outside the small set `{quantity, qty, antal, määrä, anzahl, count}` — that is, the name must include product-distinguishing information.

## Related

- [Rule pack INDEX](./INDEX.md)
- WCAG Understanding 3.3.2: <https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions.html>
- WCAG Understanding 4.1.2: <https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html>
- W3C Accessible Name and Description Computation: <https://www.w3.org/TR/accname-1.2/>
