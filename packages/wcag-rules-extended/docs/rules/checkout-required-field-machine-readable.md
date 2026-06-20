<!--
SPDX-FileCopyrightText: 2026 Alekszandr Bricskin (Agonist Development AB, Sweden, org.nr 559452-5726)
SPDX-License-Identifier: EUPL-1.2
-->

# checkout-required-field-machine-readable

**Rule ID:** `ariada/checkout/required-field-machine-readable`
**Pack:** checkout
**WCAG SC:** 3.3.2 Labels or Instructions (Level A), 1.3.1 Info and Relationships (Level A)
**EN 301 549 v3.2.1:** §9.3.3.2, §9.1.3.1
**EAA Annex I §:** I.3 (E-commerce services)
**Impact:** serious

## What this rule checks

The rule examines `<input>`, `<select>`, and `<textarea>` elements inside a checkout flow and identifies fields whose label contains a visual "required" indicator — an asterisk `*`, the word "required", or a Nordic-locale equivalent (`obligatorisk`, `pakollinen`, `nødvendig`). For each such field, it verifies the input declares the requirement programmatically with the `required` attribute, `aria-required="true"`, or both. Fields whose label says "Email *" but whose markup has no `required` attribute fail.

## Why this matters under EAA 2025

E-commerce checkout under EAA §I.3 commonly distinguishes required from optional fields with a typographic asterisk and a footnote like "* indicates a required field". Sighted users see the asterisk; screen-reader users hear the field label without "required" attached unless the markup carries the programmatic flag. The result is a class of failure where the user fills required fields haphazardly, hits "Place order", and gets a validation error they could have avoided. WCAG 3.3.2 and 1.3.1 together require that the visual requirement information also exist programmatically.

## Pass example

```html
<label for="email">Email *
  <input id="email" type="email" required>
</label>

<label for="card">Card number (required)
  <input id="card" type="text" aria-required="true">
</label>

<fieldset>
  <legend>* Required field</legend>
  <label for="postal">Postal code *
    <input id="postal" type="text" required>
  </label>
</fieldset>
```

## Fail example

```html
<label for="email">Email *
  <input id="email" type="email">
</label>

<label for="card">Card number *
  <input id="card" type="text">
</label>
```

## Implementation notes

The `matches` function walks the input's label text (resolved via the accname algorithm) and surrounding visible text up to the parent block-level element, looking for the asterisk character `*`, the substring `(required)`, or locale-specific tokens. The check passes if either `required` or `aria-required="true"` is present. The reverse pattern (input is `required` but label has no visual marker) is OUT of scope for this rule — it is a sighted-user issue and a separate rule may cover it later.

## Related

- [Rule pack INDEX](./INDEX.md)
- WCAG Understanding 3.3.2: <https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions.html>
- WCAG Understanding 1.3.1: <https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html>
- HTML Living Standard `required` attribute: <https://html.spec.whatwg.org/multipage/input.html#the-required-attribute>
