<!--
SPDX-FileCopyrightText: 2026 Alekszandr Bricskin (Agonist Development AB, Sweden, org.nr 559452-5726)
SPDX-License-Identifier: EUPL-1.2
-->

# banking-currency-format-readable

**Rule ID:** `ariada/banking/currency-format-readable`
**Pack:** banking
**WCAG SC:** 1.3.1 Info and Relationships (Level A)
**EN 301 549 v3.2.1:** §9.1.3.1
**EAA Annex I §:** I.4 (Banking services)
**Impact:** minor

## What this rule checks

The rule scans elements that look like currency displays (matched by `[class]`, `[id]`, or `[data-role]` attributes whose value looks currency-related) and verifies that the amount is exposed in a machine-readable form: `<data value="…">`, `<output>`, or an explicit `aria-label`. Bare visual strings like `1 234,56 kr` are surfaced as failures because screen readers read them character-by-character or with the wrong decimal handling.

## Why this matters under EAA 2025

Banking services are in scope of EAA Annex I §I.4 (consumer credit, payment accounts, electronic money). The EU baseline for accessible service delivery includes balance and transaction amounts being announced correctly by screen readers — "one thousand two hundred thirty-four kronor and fifty-six öre", not "one space two three four comma five six kr". Locale-specific decimal separators (Nordic `,` vs English `.`) compound the ambiguity if the markup gives the assistive technology no semantic anchor.

## Pass example

```html
<p>Balance: <data value="1234.56">1 234,56 kr</data></p>
<p>Balance: <output aria-label="1234 kronor and 56 öre">1 234,56 kr</output></p>
```

## Fail example

```html
<p class="amount-display">1 234,56 kr</p>
<span data-role="currency">SEK 1.234,56</span>
```

## Implementation notes

The CSS selector is intentionally broad (`[class], [id], [data-role]`) because axe-core's selector parser rejects the case-insensitive `i` flag; the runtime `matches` function applies a case-insensitive regex over the attribute values to narrow the candidate set. The check passes if the element wraps a `<data>` or `<output>` child, or carries an `aria-label` attribute.

## Related

- [Rule pack INDEX](./INDEX.md)
- WCAG Understanding 1.3.1: <https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html>
- EN 301 549 v3.2.1: <https://www.etsi.org/deliver/etsi_en/301500_301599/301549/03.02.01_60/en_301549v030201p.pdf>
- EAA Directive (EU) 2019/882 Annex I: <https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32019L0882>
