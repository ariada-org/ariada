<!--
SPDX-FileCopyrightText: 2026 Alekszandr Bricskin (Agonist Development AB, Sweden, org.nr 559452-5726)
SPDX-License-Identifier: EUPL-1.2
-->

# checkout-autocomplete-personal-data

**Rule ID:** `ariada/checkout/autocomplete-personal-data`
**Pack:** checkout
**WCAG SC:** 1.3.5 Identify Input Purpose (Level AA)
**EN 301 549 v3.2.1:** §9.1.3.5
**EAA Annex I §:** I.3 (E-commerce services)
**Impact:** moderate

## What this rule checks

The rule examines form inputs (`<input>`, `<select>`, `<textarea>`) that look like personal-data fields based on name, id, class, label text, or `aria-label` matching tokens such as `name`, `email`, `tel`, `address`, `postal`, `city`, `country`. For each match, it verifies that the input declares an appropriate `autocomplete` attribute from the WHATWG taxonomy: `given-name`, `family-name`, `email`, `tel`, `street-address`, `postal-code`, `address-level2`, `country-name`, etc. Inputs that look personal but lack `autocomplete` fail.

## Why this matters under EAA 2025

E-commerce checkout flows in scope of EAA Annex I §I.3 must be operable by users with motor disabilities and cognitive disabilities who rely on browser and password-manager autofill to avoid repeated typing. WCAG 1.3.5 (Identify Input Purpose) operationalises this for the common case: when a field is programmatically identified as collecting a specific kind of personal data, assistive technology can fill it automatically, reducing cognitive load and reducing transcription errors. EU consumer-protection authorities have repeatedly emphasised that checkout barriers are a leading abandonment cause for users with disabilities.

## Pass example

```html
<label for="email">Email
  <input id="email" type="email" autocomplete="email">
</label>
<label for="fname">First name
  <input id="fname" type="text" autocomplete="given-name">
</label>
<label for="postal">Postal code
  <input id="postal" type="text" autocomplete="postal-code">
</label>
```

## Fail example

```html
<label for="email">Email
  <input id="email" type="text">
</label>
<label for="fname">First name
  <input id="fname" type="text">
</label>
```

## Implementation notes

The `matches` function applies a case-insensitive regex against multiple name-candidate signals (`name`, `id`, `class`, `placeholder`, label text, `aria-label`). The check passes when a non-empty `autocomplete` attribute is present and its value belongs to the WHATWG token list. The empty `autocomplete=""` and the explicit `autocomplete="off"` token are NOT exempt — checkout fields must accept browser/password-manager autofill.

## Related

- [Rule pack INDEX](./INDEX.md)
- WCAG Understanding 1.3.5: <https://www.w3.org/WAI/WCAG22/Understanding/identify-input-purpose.html>
- HTML Living Standard `autocomplete` taxonomy: <https://html.spec.whatwg.org/multipage/form-control-infrastructure.html#autofill>
