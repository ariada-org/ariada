<!--
SPDX-FileCopyrightText: 2026 Alekszandr Bricskin (Agonist Development AB, Sweden, org.nr 559452-5726)
SPDX-License-Identifier: EUPL-1.2
-->

# checkout-discount-code-feedback

**Rule ID:** `ariada/checkout/discount-code-feedback`
**Pack:** checkout
**WCAG SC:** 3.3.1 Error Identification (Level A), 4.1.3 Status Messages (Level AA)
**EN 301 549 v3.2.1:** §9.3.3.1, §9.4.1.3
**EAA Annex I §:** I.3 (E-commerce services)
**Impact:** moderate

## What this rule checks

The rule examines `<input type="text">` fields that look like discount-code entry boxes (matched against name, id, class, label text containing "discount", "promo", "voucher", "coupon", "rabatt", "kupong"). For each match, it verifies that an `aria-describedby` attribute points to a non-empty element acting as a feedback region — and that feedback region declares a live-region attribute (`role="status"`, `role="alert"`, or `aria-live="polite"`). Inputs that produce silent visual feedback (a "Discount applied" message that screen readers cannot hear) fail.

## Why this matters under EAA 2025

Discount-code application is a small but high-impact moment in the checkout flow under EAA §I.3: a successful application changes the visible total, and a failed application surfaces an error. Sighted users see both outcomes immediately; screen-reader users see neither without a live-region attribute. WCAG 4.1.3 (Status Messages) requires that status changes not requiring focus be announced. WCAG 3.3.1 (Error Identification) requires that error states be identifiable. Together they specify the dual-role region this rule looks for.

## Pass example

```html
<label for="promo"
  >Discount code
  <input id="promo" type="text" aria-describedby="promo-feedback" />
  <button>Apply</button>
</label>
<div id="promo-feedback" role="status" aria-live="polite"></div>
```

After "Apply" is pressed, JavaScript writes either "Discount of 10 % applied; new total 179 kr" or "Code not valid" into the feedback region; the screen reader announces it because of `role="status"`.

## Fail example

```html
<label for="promo"
  >Discount code
  <input id="promo" type="text" />
  <button>Apply</button>
</label>
<div id="promo-feedback" class="green-text"></div>
```

## Implementation notes

The `matches` function applies a case-insensitive regex over `name`, `id`, `class`, label text, and `aria-label`. The check follows the `aria-describedby` IDREF to the target element and passes only if that element carries `role="status"`, `role="alert"`, `role="log"`, or non-empty `aria-live`.

## Related

- [Rule pack INDEX](./INDEX.md)
- WCAG Understanding 3.3.1: <https://www.w3.org/WAI/WCAG22/Understanding/error-identification.html>
- WCAG Understanding 4.1.3: <https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html>
- EN 301 549 v3.2.1: <https://www.etsi.org/deliver/etsi_en/301500_301599/301549/03.02.01_60/en_301549v030201p.pdf>
