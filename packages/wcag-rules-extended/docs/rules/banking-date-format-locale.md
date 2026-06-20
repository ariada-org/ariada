<!--
SPDX-FileCopyrightText: 2026 Alekszandr Bricskin (Agonist Development AB, Sweden, org.nr 559452-5726)
SPDX-License-Identifier: EUPL-1.2
-->

# banking-date-format-locale

**Rule ID:** `ariada/banking/date-format-locale`
**Pack:** banking
**WCAG SC:** 1.3.5 Identify Input Purpose (Level AA), 3.3.2 Labels or Instructions (Level A)
**EN 301 549 v3.2.1:** §9.1.3.5, §9.3.3.2
**EAA Annex I §:** I.4 (Banking services)
**Impact:** moderate

## What this rule checks

The rule examines `<input>` elements that look like date entry fields (matched by name, id, class, or label text mentioning "date", "datum", "päivä", or similar locale tokens) and passes when either: the input uses `type="date"`, or the input carries an explicit format hint via `placeholder`, `aria-describedby`, or label text declaring the expected shape (`YYYY-MM-DD`, `DD/MM/YYYY`, etc.). Free-text date inputs with no hint fail.

## Why this matters under EAA 2025

Banking forms in scope of EAA Annex I §I.4 commonly ask for date of birth, expiry date, transfer date, or statement period bounds. Without a format hint, users with cognitive disabilities, screen-reader users, and Nordic-locale users encountering an English-default form face high error rates: `02/03/2026` is February 3rd in Sweden but March 2nd in the UK. EN 301 549 §9.3.3.2 requires labels or instructions for user input; this rule operationalises that for the specific case of date inputs.

## Pass example

```html
<label for="dob">Date of birth (YYYY-MM-DD)
  <input type="text" id="dob" placeholder="1985-03-15">
</label>

<label for="dob2">Date of birth
  <input type="date" id="dob2">
</label>
```

## Fail example

```html
<label for="dob">Date of birth
  <input type="text" id="dob">
</label>
```

## Implementation notes

The `matches` function uses a case-insensitive regex against the `name`, `id`, `class`, and associated `<label>` text. The check accepts any of: `type="date"`, non-empty `placeholder`, `aria-describedby` pointing at a non-empty element, or label text containing a date pattern hint.

## Related

- [Rule pack INDEX](./INDEX.md)
- WCAG Understanding 1.3.5: <https://www.w3.org/WAI/WCAG22/Understanding/identify-input-purpose.html>
- WCAG Understanding 3.3.2: <https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions.html>
- EN 301 549 v3.2.1: <https://www.etsi.org/deliver/etsi_en/301500_301599/301549/03.02.01_60/en_301549v030201p.pdf>
