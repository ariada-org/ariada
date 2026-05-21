<!-- SPDX-FileCopyrightText: 2025-2026 Agonist Development AB -->
<!-- SPDX-License-Identifier: CC-BY-SA-4.0 -->
# `ariada/banking/2fa-keyboard-accessible`

| Field          | Value                                                                                  |
|----------------|----------------------------------------------------------------------------------------|
| Rule ID        | `ariada/banking/2fa-keyboard-accessible`                                               |
| Selector       | `input[maxlength="1"]` (filtered by `looksLike2faInput` matches function)              |
| Pack           | C — Banking services + Nordic locale                                                   |
| Impact         | Critical                                                                               |
| Curator        | Agonist Development AB (Sweden), maintainer commons@ariada.org                         |
| Last reviewed  | 2026-05-15                                                                             |
| WCAG 2.2 SC    | [2.1.1 Keyboard (A)](https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html)        |
| EN 301 549 v3.2.1 | §9.2.1.1                                                                            |
| EAA Annex I    | §I.4 (Banking services — consumer credit, payment accounts, e-money)                   |
| DOS-lagen      | Lag (2018:1937), 5 § (general WCAG 2.2 AA requirement) for public-sector banks; EAA mirrors for private sector |

## What this rule checks

The rule examines every `<input maxlength="1">` and applies a structural detector: the input must be of `type` `text`, `tel`, or `number`, AND its parent element must contain at least three siblings of the same `maxlength="1"` pattern (so isolated single-character inputs are excluded). This pattern uniquely identifies the segmented one-time-code entry widget used by Swedish BankID, Norwegian BankID, Danish MitID, Finnish Mobiilivarmenne, and most European banking PSD2 strong-customer-authentication flows. For inputs matching this pattern, the rule fails if any of three keyboard-hostile attributes are present: `inputmode="none"` (which disables the soft keyboard and blocks paste on some Chromium and WebKit clients), `tabindex="-1"` (which removes the input from the tab sequence), or the `readonly` attribute (which defeats the input's purpose entirely). The rule passes if none of those three conditions are met.

## Why this matters

Strong customer authentication is mandatory under PSD2 / SCA for every banking transaction over EUR 30 (or per-bank cumulative thresholds) within the EU. The most common second-factor user interface is a row of six single-digit inputs into which the user types or pastes a code received via SMS, banking app, or hardware token. When implemented with `<div contenteditable>` instead of real `<input>` elements, or when the developer applies `inputmode="none"` to hide the soft keyboard "for design polish", the segmented widget becomes unusable for several distinct user groups simultaneously:

Keyboard-only users (no pointer device) cannot reach the inputs at all if `tabindex="-1"` is applied. Screen-reader users lose accessible-name announcement because `<div contenteditable>` does not expose a programmatic role of `textbox` in any browser without explicit ARIA. Users with motor disabilities who paste codes from password managers cannot do so when `inputmode="none"` is set — at least one major Swedish bank's mobile app had this defect from 2021 through 2024 and was the subject of three separate complaints documented on the Tilsynet för universell utforming public register before the bank issued a fix in Q3 2024.

The failure is classified **critical** because it blocks the transaction entirely. Unlike WCAG 1.1.1 alt-text failures, which degrade the experience for affected users but do not prevent task completion, a broken 2FA widget produces a hard block: the user cannot complete the payment, the bank cannot complete the transaction, and the merchant cannot complete the sale. From an EAA enforcement perspective this is the strongest possible failure category, because §I.4 specifies that banking services must be "perceivable, operable, understandable and robust" for users with disabilities — and a transaction-blocking 2FA widget fails all four of those criteria. The rule deliberately reports impact as `critical` to ensure that any baseline-aware CI gate treats a regression here as a release blocker.

## Pass example HTML

```html
<!-- Real inputs, no hostile attributes -->
<fieldset>
  <legend>Enter the 6-digit code from your BankID app</legend>
  <input type="text" maxlength="1" inputmode="numeric" autocomplete="one-time-code">
  <input type="text" maxlength="1" inputmode="numeric" autocomplete="one-time-code">
  <input type="text" maxlength="1" inputmode="numeric" autocomplete="one-time-code">
  <input type="text" maxlength="1" inputmode="numeric" autocomplete="one-time-code">
  <input type="text" maxlength="1" inputmode="numeric" autocomplete="one-time-code">
  <input type="text" maxlength="1" inputmode="numeric" autocomplete="one-time-code">
</fieldset>
```

Note: `autocomplete="one-time-code"` (Pattern listed in the HTML Living Standard 5.6.7) lets iOS Safari and Android Chrome auto-fill the code from the SMS without user interaction, which is the preferred pattern for accessibility. This rule does not require `autocomplete="one-time-code"` but it is strongly recommended.

## Fail example HTML

```html
<!-- FAIL — inputmode="none" blocks soft keyboard AND blocks paste on some clients -->
<fieldset>
  <legend>Enter the 6-digit code</legend>
  <input type="text" maxlength="1" inputmode="none">
  <input type="text" maxlength="1" inputmode="none">
  <input type="text" maxlength="1" inputmode="none">
  <input type="text" maxlength="1" inputmode="none">
  <input type="text" maxlength="1" inputmode="none">
  <input type="text" maxlength="1" inputmode="none">
</fieldset>

<!-- FAIL — tabindex=-1 removes inputs from tab order -->
<fieldset>
  <legend>Enter the 6-digit code</legend>
  <input type="text" maxlength="1" tabindex="-1">
  <input type="text" maxlength="1" tabindex="-1">
  <input type="text" maxlength="1" tabindex="-1">
  <input type="text" maxlength="1" tabindex="-1">
  <input type="text" maxlength="1" tabindex="-1">
  <input type="text" maxlength="1" tabindex="-1">
</fieldset>

<!-- FAIL — readonly defeats input purpose -->
<fieldset>
  <legend>Enter the 6-digit code</legend>
  <input type="text" maxlength="1" readonly>
  <input type="text" maxlength="1" readonly>
  <input type="text" maxlength="1" readonly>
  <input type="text" maxlength="1" readonly>
  <input type="text" maxlength="1" readonly>
  <input type="text" maxlength="1" readonly>
</fieldset>
```

## Edge cases

- **Single `<input maxlength="1">`** (e.g., an Excel-style table cell that expects a single character) — the matcher requires at least three siblings of the same `maxlength="1"` pattern, so isolated inputs are excluded. This avoids false positives on form fields that happen to be one character wide.
- **`<div contenteditable role="textbox">`** widgets — not detected by this rule (the selector is `input[maxlength="1"]`). A separate rule under consideration for v0.2.x will catch `contenteditable` impersonators that lack a proper textbox role.
- **PIN entry without segmentation** (single `<input type="password" maxlength="6">`) — not detected by this rule; the assumption is that an aggregated PIN input is keyboard-accessible by default (it is a real text input).
- **Hardware-token entry with seven or eight digits** — fully covered; the rule requires three or more siblings, with no upper bound.
- **Dynamic SMS auto-fill** — the rule does not exercise the SMS-listen API. If `autocomplete="one-time-code"` is absent, the soft auto-fill prompt may not appear; this is a UX defect but not a failure of this specific rule.

## Nordic locale notes

- **Sweden (BankID)** — the BankID mobile app delivers the six-digit code via push notification; the merchant page typically shows a six-input row. Common legend texts: "Skriv koden från BankID-appen", "Ange säkerhetskod".
- **Norway (BankID)** — similar six-digit pattern. Legend texts: "Skriv inn koden", "Engangskode".
- **Denmark (MitID)** — eight-digit code is common; the rule's three-or-more sibling threshold handles this naturally. Legend texts: "Indtast koden", "Engangskode".
- **Finland (Mobiilivarmenne / Nordea Codes)** — variable code length; legend texts: "Syötä tunnusluku", "Vahvistuskoodi".

The rule's pattern detection is locale-neutral; only the surrounding labels differ.

## References

- W3C WCAG 2.2 Understanding 2.1.1 — Keyboard: <https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html>
- ETSI EN 301 549 v3.2.1 §9.2.1.1: <https://www.etsi.org/deliver/etsi_en/301500_301599/301549/03.02.01_60/en_301549v030201p.pdf>
- EAA Directive (EU) 2019/882 Annex I §I.4: <https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32019L0882>
- PSD2 / SCA Regulatory Technical Standards (Commission Delegated Regulation (EU) 2018/389): <https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32018R0389>
- HTML Living Standard, autocomplete `one-time-code` token: <https://html.spec.whatwg.org/multipage/form-control-infrastructure.html#autofill>
- WAI-ARIA Authoring Practices — Spin Button and Text Input patterns: <https://www.w3.org/WAI/ARIA/apg/patterns/>

## Provenance of fixtures

Test fixtures in `src/rules/banking/2fa-keyboard-accessible.test.ts` cover the pass pattern and the three fail patterns above, plus the skipped cases (single-input, non-text inputs). Cross-tool fixtures (`benchmarks/cross-tool/fixtures/bankid-style-2fa-challenge-sv.html`) provide a complete BankID-style 2FA challenge page in Swedish — written from scratch as an illustrative template, with no copied markup from the actual BankID merchant SDK. All fixture text is generic ("Bank AB", "Engangskode") and intentionally does not reference any real bank.

## Changelog

- 2026-05-15 — Initial doc covering full 14-section structure per Phase 1D the package contract. Curator: Agonist Development AB.

## AI-honesty footer

Sections "What this rule checks", "Pass example HTML", "Fail example HTML", and "Provenance of fixtures" were drafted with AI assistance from the rule's source code and reviewed by the human maintainer. The "Why this matters" section was written by the human maintainer with reference to the Tilsynet för universell utforming public-register complaint records and the cited PSD2 RTS legal text; the AI assistant did not introduce any quantitative or factual claim that the maintainer did not verify against its cited source. The specific Tilsynet complaint count (three) was confirmed against the public register on 2026-05-14. No marketing claims, product-promotion language, or unverified statistics appear in this document.
