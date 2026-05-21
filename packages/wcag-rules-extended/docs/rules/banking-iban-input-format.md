<!--
SPDX-FileCopyrightText: 2026 Alekszandr Bricskin (Agonist Development AB, Sweden, org.nr 559452-5726)
SPDX-License-Identifier: EUPL-1.2
-->

# banking-iban-input-format

**Rule ID:** `ariada/banking/iban-input-format`
**Pack:** banking
**WCAG SC:** 3.3.2 Labels or Instructions (Level A), 1.3.5 Identify Input Purpose (Level AA)
**EN 301 549 v3.2.1:** §9.3.3.2, §9.1.3.5
**EAA Annex I §:** I.4 (Banking services)
**Impact:** moderate

## What this rule checks

The rule detects `<input>` elements that look like IBAN entry fields (matched against name, id, class, or accessible-name text containing "iban") and passes when both signals are present: an explicit `IBAN` label or `aria-label`, AND a segmented format hint shown via `placeholder` or referenced `aria-describedby`. A segmented hint chunks the 22-34 character IBAN into 4-character groups, e.g. `SE45 5000 0000 0583 9825 7466`, so screen readers can read it in clusters rather than as one long unbroken sequence.

## Why this matters under EAA 2025

IBANs are mandatory for SEPA payments under EAA §I.4 banking services. Sweden, Norway (CBAN), Denmark, Finland, and all eurozone countries require IBAN input on most retail-banking transfer flows. Without segmentation and labelling, users with dyslexia, cognitive disabilities, and screen-reader users have high IBAN-typo error rates — and a typo on a transfer is irreversible. EN 301 549 §9.3.3.2 (labels or instructions) is the underlying WCAG hook.

## Pass example

```html
<label for="iban"
  >IBAN
  <input
    type="text"
    id="iban"
    placeholder="SE45 5000 0000 0583 9825 7466"
    aria-describedby="iban-hint"
  />
  <span id="iban-hint">Enter your IBAN in groups of four characters.</span>
</label>
```

## Fail example

```html
<label for="iban"
  >Account number
  <input type="text" id="iban" />
</label>
```

## Implementation notes

The `matches` function checks if any of `name`, `id`, `class`, label-text, or `aria-label` contains `iban` case-insensitively. The check passes if the input has BOTH an accessible name mentioning "IBAN" AND a non-empty `placeholder` or non-empty `aria-describedby` target.

## Related

- [Rule pack INDEX](./INDEX.md)
- WCAG Understanding 3.3.2: <https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions.html>
- WCAG Understanding 1.3.5: <https://www.w3.org/WAI/WCAG22/Understanding/identify-input-purpose.html>
- ISO 13616-1 (IBAN format): <https://www.iso.org/standard/81090.html>
