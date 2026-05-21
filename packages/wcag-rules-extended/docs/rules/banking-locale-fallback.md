<!--
SPDX-FileCopyrightText: 2026 Alekszandr Bricskin (Agonist Development AB, Sweden, org.nr 559452-5726)
SPDX-License-Identifier: EUPL-1.2
-->

# banking-locale-fallback

**Rule ID:** `ariada/banking/locale-fallback`
**Pack:** banking
**WCAG SC:** 3.1.2 Language of Parts (Level AA)
**EN 301 549 v3.2.1:** §9.3.1.2
**EAA Annex I §:** I.4 (Banking services)
**Impact:** moderate

## What this rule checks

The rule operates at document level: when the page declares `<html lang="sv">`, `<html lang="nb">`, `<html lang="da">`, or `<html lang="fi">` (a Nordic locale), embedded foreign-language blocks — typically untranslated English error messages, English copy in marketing modules, or English vendor widgets — must declare their own `lang` attribute (`<span lang="en">…</span>`). The check fails when significant English text appears inside a Nordic-locale page without a `lang` switch.

## Why this matters under EAA 2025

Screen readers switch pronunciation engines when they encounter a `lang` change. Without the switch, a Swedish-locale Voice Over instance reads English text using Swedish phonetic rules — turning "Account expired" into unintelligible pseudo-Swedish. EN 301 549 §9.3.1.2 mirrors WCAG 3.1.2 and applies to all EAA §I.4 banking interfaces. The pattern is most common in Nordic banks that license English-language vendor SDKs (chatbots, fraud-detection notifications) without translation.

## Pass example

```html
<html lang="sv">
  <body>
    <p>Ditt konto är aktivt.</p>
    <p lang="en">Account active.</p>
  </body>
</html>
```

## Fail example

```html
<html lang="sv">
  <body>
    <p>Ditt konto är aktivt.</p>
    <p>Account active.</p>
  </body>
</html>
```

## Implementation notes

The rule samples text nodes inside the body and applies a heuristic foreign-language detector based on character n-gram frequencies. The check passes if either no significant foreign text is detected, or every foreign text block has an ancestor with a `lang` attribute different from the document `lang`.

## Related

- [Rule pack INDEX](./INDEX.md)
- WCAG Understanding 3.1.2: <https://www.w3.org/WAI/WCAG22/Understanding/language-of-parts.html>
- EN 301 549 v3.2.1: <https://www.etsi.org/deliver/etsi_en/301500_301599/301549/03.02.01_60/en_301549v030201p.pdf>
