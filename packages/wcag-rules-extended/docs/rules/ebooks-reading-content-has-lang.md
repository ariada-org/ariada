<!--
SPDX-FileCopyrightText: 2026 Alexander Brichkin (Agonist Development AB, Sweden, org.nr 559452-5726)
SPDX-License-Identifier: EUPL-1.2
-->

# ebooks-reading-content-has-lang

**Rule ID:** `ariada/ebooks/reading-content-has-lang`
**Pack:** ebooks
**WCAG SC:** 3.1.1 Language of Page (Level A)
**EN 301 549 v3.2.1:** §9.3.1.1
**EAA Annex I §:** I.5 (E-books and dedicated software)
**Impact:** serious

## What this rule checks

The rule inspects embedded reading regions — an `<article>`, an element with `role="document"` or `role="article"`, or an element carrying `data-reading-content` — and verifies that each declares a language. It passes when the region itself, or any ancestor up to and including the document element, carries a `lang` attribute whose value looks like a valid BCP-47 (Best Current Practice 47, the IETF standard for language tags) tag: a 2-3 letter primary subtag with optional hyphen-separated subtags such as a script or region. A reading region with no `lang` on itself or any ancestor fails, as does one whose `lang` is empty or malformed (for example `english!`). Elements that are not reading regions are skipped.

## Why this matters under EAA 2025

The EAA (European Accessibility Act, Directive (EU) 2019/882) requires e-books and dedicated reading software (Annex I §I.5) to be readable by assistive technology. A chapter rendered inside a host page may be in a different language than the host document's `<html lang>`; screen readers pick pronunciation and synthetic-voice rules from the nearest `lang` declaration, so a reading region with no language of its own gets read with the wrong voice. EN 301 549 v3.2.1 §9.3.1.1 is the harmonised-standard clause that echoes WCAG 3.1.1 (Language of Page).

## Pass example

```html
<article lang="sv">Kapitel ett …</article>
```

## Fail example

```html
<article>Chapter one …</article>
```

## Implementation notes

A reading region is recognised by tag (`article`), by ARIA role (`document` or `article`), or by the `data-reading-content` marker attribute. The check looks for the nearest `lang`-bearing ancestor-or-self, so a region inside `<div lang="sv">…</div>` passes by inheritance. The BCP-47 validation is a shape check, not a registry lookup: it accepts subtagged values such as `zh-Hant` but rejects an empty string or a value that does not match the primary-subtag pattern.

## Related

- [Rule pack INDEX](./INDEX.md)
- WCAG Understanding 3.1.1 Language of Page: <https://www.w3.org/WAI/WCAG22/Understanding/language-of-page.html>
