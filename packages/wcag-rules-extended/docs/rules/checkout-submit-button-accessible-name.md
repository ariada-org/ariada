<!--
SPDX-FileCopyrightText: 2026 Alekszandr Bricskin (Agonist Development AB, Sweden, org.nr 559452-5726)
SPDX-License-Identifier: EUPL-1.2
-->

# checkout-submit-button-accessible-name

**Rule ID:** `ariada/checkout/submit-button-accessible-name`
**Pack:** checkout
**WCAG SC:** 2.4.4 Link Purpose (In Context) (Level A), 2.5.3 Label in Name (Level A), 4.1.2 Name, Role, Value (Level A)
**EN 301 549 v3.2.1:** §9.2.4.4, §9.2.5.3, §9.4.1.2
**EAA Annex I §:** I.3 (E-commerce services)
**Impact:** moderate

## What this rule checks

The rule examines `<button type="submit">`, `<button>` without explicit type, and `<input type="submit">` elements that look like a checkout terminal-step submit button (matched by ancestor form id/class containing `checkout`, `payment`, `order`, or by visual position at the end of a multi-section form). For each match, it verifies the button's accessible name is action-specific rather than generic: "Place order", "Pay now", "Pay 199 SEK", "Slutför köp" are passes; "Submit", "Send", "OK", "Continue" without product context are failures.

## Why this matters under EAA 2025

E-commerce checkout terminal buttons are the highest-leverage interaction in the EAA §I.3 flow. Users with cognitive disabilities, voice-control users, and screen-reader users navigating by button list need the button's purpose to be self-evident outside of full visual context. "Submit" appears on every form in the world; "Place order" tells the user what is about to happen. WCAG 2.5.3 (Label in Name) additionally requires that the spoken accessible name include the visible label text — important for voice-control users saying "click place order".

## Pass example

```html
<button type="submit">Place order</button>
<button type="submit">Pay 199 SEK</button>
<button type="submit">Slutför köp</button>
<input type="submit" value="Confirm and pay" />
```

## Fail example

```html
<button type="submit">Submit</button>
<button>Send</button>
<input type="submit" value="OK" />
<button type="submit">Continue</button>
```

## Implementation notes

The `matches` function climbs ancestors looking for the checkout form-context signals. The check resolves the accessible name per the accname spec and rejects names that match the generic-name regex `/^(submit|send|ok|continue|next|go|done|finish|complete)$/i`. Names that include either a product/order-specific term (`order`, `pay`, `purchase`, `checkout`, `buy`) or a numeric amount pass.

## Related

- [Rule pack INDEX](./INDEX.md)
- WCAG Understanding 2.4.4: <https://www.w3.org/WAI/WCAG22/Understanding/link-purpose-in-context.html>
- WCAG Understanding 2.5.3: <https://www.w3.org/WAI/WCAG22/Understanding/label-in-name.html>
- WCAG Understanding 4.1.2: <https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html>
