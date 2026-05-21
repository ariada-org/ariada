<!--
SPDX-FileCopyrightText: 2026 Alekszandr Bricskin (Agonist Development AB, Sweden, org.nr 559452-5726)
SPDX-License-Identifier: EUPL-1.2
-->

# banking-numeric-validation-error

**Rule ID:** `ariada/banking/numeric-validation-error-locale`
**Pack:** banking
**WCAG SC:** 3.1.1 Language of Page (Level A), 3.3.1 Error Identification (Level A)
**EN 301 549 v3.2.1:** §9.3.1.1, §9.3.3.1
**EAA Annex I §:** I.4 (Banking services)
**Impact:** moderate

## What this rule checks

The rule operates document-level on pages whose `<html lang>` declares a Nordic locale (`sv`, `nb`, `nn`, `da`, `fi`). It locates validation-error messages in the DOM (text inside elements with `role="alert"`, `aria-live`, or class/id matching `/(error|invalid|validation)/i`) and verifies their content language matches the page locale. English error text in a Swedish-locale page fails — Swedish users on a Swedish bank should see Swedish errors.

## Why this matters under EAA 2025

EAA §I.4 banking services must be operable for users in their native language. Mixed-language interfaces force users with cognitive disabilities to context-switch, and screen-reader users hear English text mispronounced through the Swedish phonetic engine. WCAG 3.1.1 (Language of Page) and 3.3.1 (Error Identification) together require that error messages be both correctly attributed to a language AND understandable by the user. Most Nordic banks license validation messages from vendor SDKs that default to English; this rule surfaces the gap.

## Pass example

```html
<html lang="sv">
  <body>
    <div role="alert">Beloppet måste vara större än noll.</div>
  </body>
</html>
```

## Fail example

```html
<html lang="sv">
  <body>
    <div role="alert">Amount must be greater than zero.</div>
  </body>
</html>
```

## Implementation notes

The check uses character n-gram frequency analysis on each error-text candidate. Swedish detects on `å, ä, ö` plus common digraphs (`tj`, `sk`, `kj`); Finnish on double vowels and `y`; Danish/Norwegian on `æ, ø, å`. If an error contains predominantly English vocabulary (`must`, `cannot`, `please`, `try`) and the page is Nordic-locale, the rule fails.

## Related

- [Rule pack INDEX](./INDEX.md)
- WCAG Understanding 3.1.1: <https://www.w3.org/WAI/WCAG22/Understanding/language-of-page.html>
- WCAG Understanding 3.3.1: <https://www.w3.org/WAI/WCAG22/Understanding/error-identification.html>
- EN 301 549 v3.2.1: <https://www.etsi.org/deliver/etsi_en/301500_301599/301549/03.02.01_60/en_301549v030201p.pdf>
