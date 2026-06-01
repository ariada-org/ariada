<!--
SPDX-FileCopyrightText: 2026 Alexander Brichkin (Agonist Development AB, Sweden, org.nr 559452-5726)
SPDX-License-Identifier: EUPL-1.2
-->

# ebooks-text-spacing-overridable

**Rule ID:** `ariada/ebooks/text-spacing-overridable`
**Pack:** ebooks
**WCAG SC:** 1.4.12 Text Spacing (Level AA)
**EN 301 549 v3.2.1:** §9.1.4.12
**EAA Annex I §:** I.5 (E-books and dedicated software)
**Impact:** serious

## What this rule checks

The rule inspects elements in a reading surface that carry an inline `style` setting one of the three text-spacing properties WCAG 1.4.12 expects users to be able to override: `line-height`, `letter-spacing`, or `word-spacing`. It fails when any of those properties is declared with `!important`, because an `!important` inline declaration wins over a user stylesheet's normal-priority declarations and locks the reader out of the spacing adjustments the success criterion guarantees. The same property without `!important` passes, as does `!important` on an unrelated property such as `color`. Property names and the `important` keyword are matched case-insensitively, and whitespace between the bang and the keyword (`! important`) is still caught.

## Why this matters under EAA 2025

The EAA (European Accessibility Act, Directive (EU) 2019/882) requires e-books and their dedicated reading software (Annex I §I.5) to let readers adapt presentation. Readers with dyslexia or low vision commonly inject a custom stylesheet — a bookmarklet or a browser-level user sheet — to open up line and letter spacing for legibility. An inline `!important` spacing rule silently defeats that adaptation across an entire chapter. EN 301 549 v3.2.1 §9.1.4.12 is the harmonised-standard clause that echoes WCAG 1.4.12 (Text Spacing).

## Pass example

```html
<p style="line-height: 1.6; letter-spacing: 0.05em; word-spacing: 0.1em">chapter text</p>
```

## Fail example

```html
<p style="line-height: 1.2 !important">chapter text</p>
```

## Implementation notes

An element with no `style` attribute, or a `style` that contains none of the three spacing properties, is skipped. The `style` string is split on `;`, and each declaration on its first `:` only, so a value that itself contains a colon survives intact. A declaration with no colon is ignored, so a malformed entry such as `line-height 1.2 important` does not trigger a failure. Only `line-height`, `letter-spacing`, and `word-spacing` are checked; `!important` on any other property is allowed.

## Related

- [Rule pack INDEX](./INDEX.md)
- WCAG Understanding 1.4.12 Text Spacing: <https://www.w3.org/WAI/WCAG22/Understanding/text-spacing.html>
