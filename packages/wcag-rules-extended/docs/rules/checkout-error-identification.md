<!--
SPDX-FileCopyrightText: 2026 Alekszandr Bricskin (Agonist Development AB, Sweden, org.nr 559452-5726)
SPDX-License-Identifier: EUPL-1.2
-->

# checkout-error-identification

**Rule ID:** `ariada/checkout/error-identification`
**Pack:** checkout
**WCAG SC:** 3.3.1 Error Identification (Level A), 4.1.3 Status Messages (Level AA)
**EN 301 549 v3.2.1:** §9.3.3.1, §9.4.1.3
**EAA Annex I §:** I.3 (E-commerce services)
**Impact:** serious

## What this rule checks

The rule locates DOM elements that look like form-validation error messages (matched by `class` or `id` containing `error`, `invalid`, `err-`, `validation-error`, etc.) and verifies two things at once. First, the error element is programmatically associated with its input field via `aria-errormessage`, `aria-describedby`, or by sitting inside the same `<label>` as the input. Second, the error region announces itself: `role="alert"`, `aria-live="assertive"`, or `role="status"`. Errors that are only visible (red text, icon) without programmatic association fail.

## Why this matters under EAA 2025

Checkout validation is high-stakes in EAA §I.3: a payment-form error that screen-reader users cannot hear means the user clicks "Place order" repeatedly, wondering why nothing happens. WCAG 3.3.1 specifies that errors must be "identified and the error described to the user in text" — the implicit assumption is that the description reaches the user. For screen-reader users, that requires programmatic association AND live-region announcement.

## Pass example

```html
<label for="card"
  >Card number
  <input
    id="card"
    type="text"
    aria-invalid="true"
    aria-errormessage="card-err"
  />
</label>
<span id="card-err" role="alert">Card number must be 16 digits.</span>

<label for="cvv"
  >CVV
  <input id="cvv" type="text" aria-describedby="cvv-err" />
  <span id="cvv-err" aria-live="assertive">CVV must be 3 digits.</span>
</label>
```

## Fail example

```html
<label for="card"
  >Card number
  <input id="card" type="text" />
</label>
<span class="error-text">Card number must be 16 digits.</span>
```

## Implementation notes

The CSS selector is intentionally broad because axe-core's selector parser rejects the case-insensitive `i` flag. The runtime `matches` function applies a case-insensitive regex over `class` and `id` values. The check first looks for an inverse `aria-errormessage` or `aria-describedby` from any input element back to the candidate error element; it then verifies the error element has a live-region attribute or role.

## Related

- [Rule pack INDEX](./INDEX.md)
- WCAG Understanding 3.3.1: <https://www.w3.org/WAI/WCAG22/Understanding/error-identification.html>
- WCAG Understanding 4.1.3: <https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html>
- W3C ARIA `aria-errormessage`: <https://www.w3.org/TR/wai-aria-1.2/#aria-errormessage>
