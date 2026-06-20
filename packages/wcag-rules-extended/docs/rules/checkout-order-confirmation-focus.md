<!--
SPDX-FileCopyrightText: 2026 Alekszandr Bricskin (Agonist Development AB, Sweden, org.nr 559452-5726)
SPDX-License-Identifier: EUPL-1.2
-->

# checkout-order-confirmation-focus

**Rule ID:** `ariada/checkout/order-confirmation-focus`
**Pack:** checkout
**WCAG SC:** 2.4.3 Focus Order (Level A), 2.4.6 Headings and Labels (Level AA), 4.1.3 Status Messages (Level AA)
**EN 301 549 v3.2.1:** §9.2.4.3, §9.2.4.6, §9.4.1.3
**EAA Annex I §:** I.3 (E-commerce services)
**Impact:** serious

## What this rule checks

The rule locates the page `<h1>` and tests whether it looks like an order-confirmation heading (text matching `/thank|confirmation|order.*placed|tack|kvitto|bestätigt|tilauksesi/i`). For each match, it verifies the page provides screen-reader notification of arrival by one of three mechanisms: the `<h1>` has `tabindex="-1"` and JavaScript focuses it on load, the `<h1>` (or an ancestor) declares `role="status"` or `aria-live="polite"`, or the page implements an SPA-pattern focus management hook around route changes.

## Why this matters under EAA 2025

For most checkout flows, the order-confirmation page is the most important navigation event of the entire session: it tells the user the transaction succeeded. Screen-reader users navigating an SPA-style checkout (popular under EAA §I.3) have no automatic browser-level notification when the URL changes — their cursor is still in the "Place order" button on the previous page. Without a focus or live-region intervention, the user is left guessing whether the order actually succeeded. WCAG 4.1.3 (Status Messages) was authored specifically for this pattern.

## Pass example

```html
<h1 tabindex="-1" id="confirm">Thank you! Your order is placed.</h1>
<script>document.getElementById('confirm').focus();</script>

<h1 role="status">Tack för din beställning!</h1>

<div aria-live="polite">
  <h1>Order placed</h1>
  <p>Confirmation 12345 sent to your email.</p>
</div>
```

## Fail example

```html
<h1>Thank you! Your order is placed.</h1>
```

## Implementation notes

The `matches` function applies a case-insensitive regex over the `<h1>` text content with Nordic-locale alternatives (`tack`, `kvitto`, `tilauksesi`, `kiitos`). The check passes if the heading element OR any ancestor up to `<body>` carries `tabindex="-1"`, `role="status"`, `role="alert"`, or non-empty `aria-live`.

## Related

- [Rule pack INDEX](./INDEX.md)
- WCAG Understanding 2.4.3: <https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html>
- WCAG Understanding 2.4.6: <https://www.w3.org/WAI/WCAG22/Understanding/headings-and-labels.html>
- WCAG Understanding 4.1.3: <https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html>
