<!--
SPDX-FileCopyrightText: 2026 Alekszandr Bricskin (Agonist Development AB, Sweden, org.nr 559452-5726)
SPDX-License-Identifier: EUPL-1.2
-->

# banking-transaction-amount-input

**Rule ID:** `ariada/banking/transaction-amount-input`
**Pack:** banking
**WCAG SC:** 1.3.5 Identify Input Purpose (Level AA), 3.3.2 Labels or Instructions (Level A)
**EN 301 549 v3.2.1:** §9.1.3.5, §9.3.3.2
**EAA Annex I §:** I.4 (Banking services)
**Impact:** serious

## What this rule checks

The rule examines `<input>` elements that look like amount-entry fields (matched against name, id, class, or label text containing "amount", "belopp", "summa", "määrä", or similar) and passes when both signals are present: `inputmode="decimal"` (or `type="number"`) is declared, AND currency context is provided via the accessible name, an adjacent currency-code element, or `aria-describedby` pointing to a non-empty hint. Bare amount inputs with neither signal fail.

## Why this matters under EAA 2025

Bank transfers are the highest-stakes form interaction in EAA §I.4 — a typo on an amount is irreversible. Users with motor disabilities need `inputmode="decimal"` to surface the correct soft keyboard on touch devices; screen-reader users need the currency announced so they can verify "1234 kronor" not just "1234". WCAG 1.3.5 (programmatic identification of input purpose) and 3.3.2 (labels or instructions) both apply. The Nordic-locale dimension — SEK, NOK, DKK, EUR for Finland — multiplies the risk because cross-border SEPA transfers commonly default to EUR even on a Swedish bank.

## Pass example

```html
<label for="amount"
  >Amount in SEK
  <input
    id="amount"
    type="text"
    inputmode="decimal"
    aria-describedby="amount-hint"
  />
  <span id="amount-hint">Enter the amount in Swedish kronor.</span>
</label>

<label for="amount2"
  >Belopp
  <input id="amount2" type="number" step="0.01" />
  <span>SEK</span>
</label>
```

## Fail example

```html
<label for="amount"
  >Amount
  <input id="amount" type="text" />
</label>
```

## Implementation notes

The `matches` function uses a case-insensitive regex against `name`, `id`, `class`, `aria-label`, and associated label text. The check accepts `inputmode="decimal"` OR `inputmode="numeric"` OR `type="number"` for the input-mode signal, and an explicit currency mention in the accessible name OR an `aria-describedby` reference resolving to non-empty text OR an adjacent currency-code element.

## Related

- [Rule pack INDEX](./INDEX.md)
- WCAG Understanding 1.3.5: <https://www.w3.org/WAI/WCAG22/Understanding/identify-input-purpose.html>
- WCAG Understanding 3.3.2: <https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions.html>
- HTML Living Standard `inputmode`: <https://html.spec.whatwg.org/multipage/interaction.html#input-modalities%3A-the-inputmode-attribute>
