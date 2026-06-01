<!--
SPDX-FileCopyrightText: 2026 Alexander Brichkin (Agonist Development AB, Sweden, org.nr 559452-5726)
SPDX-License-Identifier: EUPL-1.2
-->

# ebooks-viewport-allows-zoom

**Rule ID:** `ariada/ebooks/viewport-allows-zoom`
**Pack:** ebooks
**WCAG SC:** 1.4.4 Resize Text (Level AA)
**EN 301 549 v3.2.1:** §9.1.4.4
**EAA Annex I §:** I.5 (E-books and dedicated software)
**Impact:** serious

## What this rule checks

The rule inspects the `<meta name="viewport">` tag of a reading surface (an e-book reader, a long-form article view, or a dedicated reading-software web shell) and fails when that tag suppresses or under-caps browser zoom. It parses the comma-separated `content` attribute into directives and fails in two cases: `user-scalable=no` (or the numeric form `user-scalable=0`), which disables pinch and keyboard magnification entirely; and `maximum-scale` set to a numeric value below 2, which caps zoom under the 200% floor WCAG 1.4.4 guarantees. A `maximum-scale` of exactly 2, a value of 5, a non-numeric value, an absent scale cap, or an empty `content` all pass. Directive keys and values are matched case-insensitively, and irregular spacing around `=` and `,` is tolerated.

## Why this matters under EAA 2025

The EAA (European Accessibility Act, Directive (EU) 2019/882) requires e-books and their dedicated reading software (Annex I §I.5) to be perceivable by people with low vision. Readers who magnify text up to 200% rely on the browser's native zoom; a viewport tag that locks scaling removes that adjustment for the whole reading surface, and the longer the text, the worse the impact. EN 301 549 v3.2.1 §9.1.4.4 is the harmonised-standard clause that echoes WCAG 1.4.4 (Resize Text) for this requirement.

## Pass example

```html
<meta name="viewport" content="width=device-width, maximum-scale=5">
```

## Fail example

```html
<meta name="viewport" content="width=device-width, user-scalable=no">
```

## Implementation notes

The check only acts on a `<meta>` element whose `name` is `viewport`; any other meta tag is skipped, and a viewport tag with no `content` passes. The `content` string is split on commas, then each part on its first `=`, with keys and values lower-cased and trimmed. A `maximum-scale` that cannot be parsed as a finite number (for example `maximum-scale=abc`) passes, because no numeric cap can be proven. `maximum-scale=2` passes because 2 is exactly the 200% floor, not below it.

## Related

- [Rule pack INDEX](./INDEX.md)
- WCAG Understanding 1.4.4 Resize Text: <https://www.w3.org/WAI/WCAG22/Understanding/resize-text.html>
