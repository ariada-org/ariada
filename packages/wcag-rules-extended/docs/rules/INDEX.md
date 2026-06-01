<!-- SPDX-FileCopyrightText: 2025-2026 Agonist Development AB -->
<!-- SPDX-License-Identifier: CC-BY-SA-4.0 -->
# Rule catalogue — `@ariada-org/wcag-rules-extended`

This file lists every rule in the package. Five rules are documented in full (~600-1200 words each) as showcase examples; the remaining 31 each carry a shorter (~200 words) reference doc alongside this file covering what the rule checks, why under EAA, pass/fail examples, and implementation notes. All 36 rule-doc files live in this directory and are the targets of the rules' `helpUrl` metadata.

## Alphabetical quick-reference

| Rule ID | Pack | Doc |
|---------|------|-----|
| `ariada/banking/2fa-keyboard-accessible` | banking | [banking-2fa-keyboard-accessible.md](banking-2fa-keyboard-accessible.md) |
| `ariada/banking/currency-format-readable` | banking | [banking-currency-format-readable.md](banking-currency-format-readable.md) |
| `ariada/banking/date-format-locale` | banking | [banking-date-format-locale.md](banking-date-format-locale.md) |
| `ariada/banking/iban-input-format` | banking | [banking-iban-input-format.md](banking-iban-input-format.md) |
| `ariada/banking/lang-matches-locale` | banking | [banking-lang-matches-locale.md](banking-lang-matches-locale.md) |
| `ariada/banking/locale-fallback` | banking | [banking-locale-fallback.md](banking-locale-fallback.md) |
| `ariada/banking/login-error-not-blocking` | banking | [banking-login-error-not-blocking.md](banking-login-error-not-blocking.md) |
| `ariada/banking/numeric-validation-error-locale` | banking | [banking-numeric-validation-error.md](banking-numeric-validation-error.md) |
| `ariada/banking/session-timeout-warning` | banking | [banking-session-timeout-warning.md](banking-session-timeout-warning.md) |
| `ariada/banking/transaction-amount-input` | banking | [banking-transaction-amount-input.md](banking-transaction-amount-input.md) |
| `ariada/checkout/autocomplete-personal-data` | checkout | [checkout-autocomplete-personal-data.md](checkout-autocomplete-personal-data.md) |
| `ariada/ebooks/audio-control-on-autoplay` | ebooks | [ebooks-audio-control-on-autoplay.md](ebooks-audio-control-on-autoplay.md) |
| `ariada/ebooks/no-positive-tabindex-in-reading` | ebooks | [ebooks-no-positive-tabindex-in-reading.md](ebooks-no-positive-tabindex-in-reading.md) |
| `ariada/ebooks/reading-content-has-lang` | ebooks | [ebooks-reading-content-has-lang.md](ebooks-reading-content-has-lang.md) |
| `ariada/ebooks/text-spacing-overridable` | ebooks | [ebooks-text-spacing-overridable.md](ebooks-text-spacing-overridable.md) |
| `ariada/ebooks/viewport-allows-zoom` | ebooks | [ebooks-viewport-allows-zoom.md](ebooks-viewport-allows-zoom.md) |
| `ariada/checkout/cart-quantity-input-label` | checkout | [checkout-cart-quantity-input-label.md](checkout-cart-quantity-input-label.md) |
| `ariada/checkout/cart-update-live-region` | checkout | [checkout-cart-update-live-region.md](checkout-cart-update-live-region.md) |
| `ariada/checkout/discount-code-feedback` | checkout | [checkout-discount-code-feedback.md](checkout-discount-code-feedback.md) |
| `ariada/checkout/error-identification` | checkout | [checkout-error-identification.md](checkout-error-identification.md) |
| `ariada/checkout/form-label-association` | checkout | [checkout-form-label-association.md](checkout-form-label-association.md) |
| `ariada/checkout/order-confirmation-focus` | checkout | [checkout-order-confirmation-focus.md](checkout-order-confirmation-focus.md) |
| `ariada/checkout/payment-fieldset-grouping` | checkout | [checkout-payment-fieldset-grouping.md](checkout-payment-fieldset-grouping.md) |
| `ariada/checkout/required-field-machine-readable` | checkout | [checkout-required-field-machine-readable.md](checkout-required-field-machine-readable.md) |
| `ariada/checkout/step-keyboard-accessible` | checkout | [checkout-step-keyboard.md](checkout-step-keyboard.md) |
| `ariada/checkout/submit-button-accessible-name` | checkout | [checkout-submit-button-accessible-name.md](checkout-submit-button-accessible-name.md) |
| `ariada/statement/conformance-level-declared` | statement | [statement-conformance-level.md](statement-conformance-level.md) |
| `ariada/statement/enforcement-procedure-link` | statement | [statement-enforcement-procedure.md](statement-enforcement-procedure.md) |
| `ariada/statement/feedback-mechanism-present` | statement | [statement-feedback-mechanism.md](statement-feedback-mechanism.md) |
| `ariada/statement/last-revision-date` | statement | [statement-last-revision-date.md](statement-last-revision-date.md) |
| `ariada/statement/methodology-disclosed` | statement | [statement-methodology.md](statement-methodology.md) |
| `ariada/statement/non-conformance-items-listed` | statement | [statement-non-conformance-items.md](statement-non-conformance-items.md) |
| `ariada/statement/page-link-from-footer` | statement | [statement-page-link-from-footer.md](statement-page-link-from-footer.md) |
| `ariada/statement/publication-date-present` | statement | [statement-publication-date-present.md](statement-publication-date-present.md) |
| `ariada/statement/skip-link-from-every-page` | statement | [statement-skip-link.md](statement-skip-link.md) |
| `ariada/statement/standard-reference` | statement | [statement-standard-reference.md](statement-standard-reference.md) |

## Showcase rules (full documentation)

| Rule ID | Pack | WCAG SC | EN 301 549 | EAA Annex I | Doc |
|---------|------|---------|------------|-------------|-----|
| `ariada/checkout/payment-fieldset-grouping` | A — Checkout | 1.3.1, 4.1.2 | 9.1.3.1, 9.4.1.2 | §I.3 | [checkout-payment-fieldset-grouping.md](checkout-payment-fieldset-grouping.md) |
| `ariada/statement/page-link-from-footer` | B — Statement | 3.2.6 | 12.1.1 | §I.1, §I.3 | [statement-page-link-from-footer.md](statement-page-link-from-footer.md) |
| `ariada/statement/non-conformance-items-listed` | B — Statement | 3.2.6 | 12.1.1 | §I.1 | [statement-non-conformance-items.md](statement-non-conformance-items.md) |
| `ariada/banking/2fa-keyboard-accessible` | C — Banking | 2.1.1 | 9.2.1.1 | §I.4 | [banking-2fa-keyboard-accessible.md](banking-2fa-keyboard-accessible.md) |
| `ariada/banking/lang-matches-locale` | C — Banking | 3.1.1 | 9.3.1.1 | §I.1, §I.4 | [banking-lang-matches-locale.md](banking-lang-matches-locale.md) |

## Pack A — E-commerce checkout (EAA Annex I §I.3)

10 supplementary rules (the 11th, `payment-fieldset-grouping`, is documented above).

| Rule ID | WCAG SC | EN 301 549 | EAA | One-line summary | Curator | Last reviewed | Source |
|---------|---------|------------|-----|-------------------|---------|---------------|--------|
| `ariada/checkout/cart-update-live-region` | 4.1.3 | 9.4.1.3 | §I.3 | Cart-quantity changes must announce via an `aria-live` region so screen readers hear the new total. | Agonist Development AB | 2026-05-15 | [.ts](../../src/rules/checkout/cart-update-live-region.ts) · [.test.ts](../../src/rules/checkout/cart-update-live-region.test.ts) |
| `ariada/checkout/error-identification` | 3.3.1, 4.1.3 | 9.3.3.1, 9.4.1.3 | §I.3 | Checkout form errors must be programmatically associated with the failing input via `aria-describedby` or `aria-errormessage`. | Agonist Development AB | 2026-05-15 | [.ts](../../src/rules/checkout/checkout-error-identification.ts) · [.test.ts](../../src/rules/checkout/checkout-error-identification.test.ts) |
| `ariada/checkout/required-field-machine-readable` | 3.3.2, 1.3.1 | 9.3.3.2, 9.1.3.1 | §I.3 | Required fields must declare requirement programmatically (`required` attribute or `aria-required="true"`), not only via a visual asterisk. | Agonist Development AB | 2026-05-15 | [.ts](../../src/rules/checkout/required-field-machine-readable.ts) · [.test.ts](../../src/rules/checkout/required-field-machine-readable.test.ts) |
| `ariada/checkout/autocomplete-personal-data` | 1.3.5 | 9.1.3.5 | §I.3 | Personal-data inputs (name, address, email, phone, postal code) must declare the WCAG 2.1 `autocomplete` token. | Agonist Development AB | 2026-05-15 | [.ts](../../src/rules/checkout/autocomplete-personal-data.ts) · [.test.ts](../../src/rules/checkout/autocomplete-personal-data.test.ts) |
| `ariada/checkout/submit-button-accessible-name` | 2.4.4, 2.5.3, 4.1.2 | 9.2.4.4, 9.2.5.3, 9.4.1.2 | §I.3 | Checkout submit buttons must have an accessible name that describes the action ("Place order", "Pay now"), not generic "Submit". | Agonist Development AB | 2026-05-15 | [.ts](../../src/rules/checkout/submit-button-accessible-name.ts) · [.test.ts](../../src/rules/checkout/submit-button-accessible-name.test.ts) |
| `ariada/checkout/cart-quantity-input-label` | 3.3.2, 1.3.1, 4.1.2 | 9.3.3.2, 9.1.3.1, 9.4.1.2 | §I.3 | Cart quantity inputs must carry a product-distinguishing accessible name ("Quantity, T-shirt blue M", not bare "Quantity"). | Agonist Development AB | 2026-05-15 | [.ts](../../src/rules/checkout/cart-quantity-input-label.ts) · [.test.ts](../../src/rules/checkout/cart-quantity-input-label.test.ts) |
| `ariada/checkout/order-confirmation-focus` | 2.4.3, 2.4.6, 4.1.3 | 9.2.4.3, 9.2.4.6, 9.4.1.3 | §I.3 | Order-confirmation pages must move focus to a heading or announce the confirmation via live region — silent navigation breaks screen-reader workflow. | Agonist Development AB | 2026-05-15 | [.ts](../../src/rules/checkout/order-confirmation-focus.ts) · [.test.ts](../../src/rules/checkout/order-confirmation-focus.test.ts) |
| `ariada/checkout/discount-code-feedback` | 3.3.1, 4.1.3 | 9.3.3.1, 9.4.1.3 | §I.3 | Discount-code application must produce machine-readable feedback (live region or programmatically associated status text), not silent visual change. | Agonist Development AB | 2026-05-15 | [.ts](../../src/rules/checkout/discount-code-feedback.ts) · [.test.ts](../../src/rules/checkout/discount-code-feedback.test.ts) |
| `ariada/checkout/step-keyboard-accessible` | 2.1.1, 4.1.2 | 9.2.1.1, 9.4.1.2 | §I.3 | Clickable checkout-step indicators (Cart → Address → Payment → Review) must be keyboard-focusable when interactive. | Agonist Development AB | 2026-05-15 | [.ts](../../src/rules/checkout/checkout-step-keyboard.ts) · [.test.ts](../../src/rules/checkout/checkout-step-keyboard.test.ts) |
| `ariada/checkout/form-label-association` | 1.3.1, 3.3.2, 4.1.2 | 9.1.3.1, 9.3.3.2, 9.4.1.2 | §I.3 | Every checkout-flow form input must have a programmatic label (label/for, aria-label, aria-labelledby, or wrapping `<label>`). | Agonist Development AB | 2026-05-15 | [.ts](../../src/rules/checkout/checkout-form-label-association.ts) · [.test.ts](../../src/rules/checkout/checkout-form-label-association.test.ts) |

## Pack B — Accessibility statement compliance

9 supplementary rules (`page-link-from-footer` and `non-conformance-items-listed` are documented above).

| Rule ID | WCAG SC | EN 301 549 | EAA | One-line summary | Curator | Last reviewed | Source |
|---------|---------|------------|-----|-------------------|---------|---------------|--------|
| `ariada/statement/publication-date-present` | 3.2.6 | 12.1.1 | §I.1 | Statement must declare publication date in a `<time datetime="YYYY-MM-DD">` element, not as free-text prose. | Agonist Development AB | 2026-05-15 | [.ts](../../src/rules/statement/statement-publication-date.ts) · [.test.ts](../../src/rules/statement/statement-publication-date.test.ts) |
| `ariada/statement/conformance-level-declared` | 3.2.6 | 12.1.1 | §I.1 | Statement must declare a conformance level (full, partial, or non-conformant) in machine-recognisable wording per Directive 2016/2102 art. 7. | Agonist Development AB | 2026-05-15 | [.ts](../../src/rules/statement/statement-conformance-level.ts) · [.test.ts](../../src/rules/statement/statement-conformance-level.test.ts) |
| `ariada/statement/last-revision-date` | 3.2.6 | 12.1.1 | §I.1 | Statement must declare last-revision date (separate from publication date) so users know when issues were last reviewed. | Agonist Development AB | 2026-05-15 | [.ts](../../src/rules/statement/statement-last-revision-date.ts) · [.test.ts](../../src/rules/statement/statement-last-revision-date.test.ts) |
| `ariada/statement/methodology-disclosed` | 3.2.6 | 12.1.1 | §I.1 | Statement must disclose how the accessibility evaluation was performed (self-evaluation, third-party audit, mixed). | Agonist Development AB | 2026-05-15 | [.ts](../../src/rules/statement/statement-methodology.ts) · [.test.ts](../../src/rules/statement/statement-methodology.test.ts) |
| `ariada/statement/feedback-mechanism-present` | 3.2.6 | 12.1.1 | §I.1 | Statement must offer at least one feedback channel — email address, phone number, or form link — for users to report issues. | Agonist Development AB | 2026-05-15 | [.ts](../../src/rules/statement/statement-feedback-mechanism.ts) · [.test.ts](../../src/rules/statement/statement-feedback-mechanism.test.ts) |
| `ariada/statement/enforcement-procedure-link` | 3.2.6 | 12.1.1 | §I.1 | Statement must link to the national enforcement procedure (DIGG, Tilsynet, DK Digitaliseringsstyrelsen, FI AVI, equivalent). | Agonist Development AB | 2026-05-15 | [.ts](../../src/rules/statement/statement-enforcement-procedure.ts) · [.test.ts](../../src/rules/statement/statement-enforcement-procedure.test.ts) |
| `ariada/statement/standard-reference` | 3.2.6 | 12.1.1 | §I.1 | Statement must reference WCAG 2.2 AA or EN 301 549 v3.2.1 explicitly so the reader knows which standard the conformance claim is against. | Agonist Development AB | 2026-05-15 | [.ts](../../src/rules/statement/statement-standard-reference.ts) · [.test.ts](../../src/rules/statement/statement-standard-reference.test.ts) |
| `ariada/statement/skip-link-from-every-page` | 2.4.1 | 9.2.4.1 | §I.1 | Every page must include a skip-link to main content as the first focusable element so keyboard users bypass the navigation chrome. | Agonist Development AB | 2026-05-15 | [.ts](../../src/rules/statement/statement-skip-link.ts) · [.test.ts](../../src/rules/statement/statement-skip-link.test.ts) |

## Pack C — Banking + Nordic locale (EAA Annex I §I.4)

8 supplementary rules (`2fa-keyboard-accessible` and `lang-matches-locale` are documented above).

| Rule ID | WCAG SC | EN 301 549 | EAA | One-line summary | Curator | Last reviewed | Source |
|---------|---------|------------|-----|-------------------|---------|---------------|--------|
| `ariada/banking/transaction-amount-input` | 1.3.5, 3.3.2 | 9.1.3.5, 9.3.3.2 | §I.4 | Banking amount inputs must declare `inputmode="decimal"` and carry currency context (label, adjacent currency code, or `aria-describedby`). | Agonist Development AB | 2026-05-15 | [.ts](../../src/rules/banking/transaction-amount-input.ts) · [.test.ts](../../src/rules/banking/transaction-amount-input.test.ts) |
| `ariada/banking/session-timeout-warning` | 2.2.1 | 9.2.2.1 | §I.4 | Session-timeout dialogs must offer a focusable extend / continue button — silent expiry breaks form completion for slow users. | Agonist Development AB | 2026-05-15 | [.ts](../../src/rules/banking/session-timeout-warning.ts) · [.test.ts](../../src/rules/banking/session-timeout-warning.test.ts) |
| `ariada/banking/date-format-locale` | 1.3.5, 3.3.2 | 9.1.3.5, 9.3.3.2 | §I.4 | Banking date inputs must use `<input type="date">` or declare an explicit format hint (placeholder or label) per locale convention. | Agonist Development AB | 2026-05-15 | [.ts](../../src/rules/banking/date-format-locale.ts) · [.test.ts](../../src/rules/banking/date-format-locale.test.ts) |
| `ariada/banking/locale-fallback` | 3.1.2 | 9.3.1.2 | §I.4 | Foreign-language blocks within a localised page (English quote in Swedish page) must declare their own `lang` attribute. | Agonist Development AB | 2026-05-15 | [.ts](../../src/rules/banking/locale-fallback.ts) · [.test.ts](../../src/rules/banking/locale-fallback.test.ts) |
| `ariada/banking/iban-input-format` | 3.3.2, 1.3.5 | 9.3.3.2, 9.1.3.5 | §I.4 | IBAN inputs must label "IBAN" and show a segmented format hint (`SE45 5000 0000 0583 9825 7466`) so screen readers can chunk-read the number. | Agonist Development AB | 2026-05-15 | [.ts](../../src/rules/banking/iban-input-format.ts) · [.test.ts](../../src/rules/banking/iban-input-format.test.ts) |
| `ariada/banking/numeric-validation-error-locale` | 3.1.1, 3.3.1 | 9.3.1.1, 9.3.3.1 | §I.4 | Validation errors on Nordic-locale pages must be in the page language (Swedish errors on Swedish pages), not always in English. | Agonist Development AB | 2026-05-15 | [.ts](../../src/rules/banking/numeric-validation-error.ts) · [.test.ts](../../src/rules/banking/numeric-validation-error.test.ts) |
| `ariada/banking/login-error-not-blocking` | 3.3.1, 2.1.2 | 9.3.3.1, 9.2.1.2 | §I.4 | Bank login error messages must be announceable (live region or aria-describedby) AND must not lock input fields after first failure. | Agonist Development AB | 2026-05-15 | [.ts](../../src/rules/banking/bank-login-error-not-blocking.ts) · [.test.ts](../../src/rules/banking/bank-login-error-not-blocking.test.ts) |
| `ariada/banking/currency-format-readable` | 1.3.1 | 9.1.3.1 | §I.4 | Currency amounts should use `<data value="...">`, `<output>`, or `aria-label` so screen readers announce "1 234,56 Swedish krona" not "1.23456 SEK". | Agonist Development AB | 2026-05-15 | [.ts](../../src/rules/banking/currency-format-readable.ts) · [.test.ts](../../src/rules/banking/currency-format-readable.test.ts) |

## E-books (EAA Annex I §I.5)

5 rules covering e-books and dedicated reading software (reader shells, long-form article views).

| Rule ID | WCAG SC | EN 301 549 | EAA | One-line summary | Curator | Last reviewed | Source |
|---------|---------|------------|-----|-------------------|---------|---------------|--------|
| `ariada/ebooks/viewport-allows-zoom` | 1.4.4 | 9.1.4.4 | §I.5 | Reading-surface viewport meta tag must not block zoom (`user-scalable=no`) or cap `maximum-scale` below 2. | Agonist Development AB | 2026-06-01 | [.ts](../../src/rules/ebooks/viewport-allows-zoom.ts) · [.test.ts](../../src/rules/ebooks/viewport-allows-zoom.test.ts) |
| `ariada/ebooks/text-spacing-overridable` | 1.4.12 | 9.1.4.12 | §I.5 | Inline `line-height` / `letter-spacing` / `word-spacing` must not use `!important`, so a user stylesheet can override spacing. | Agonist Development AB | 2026-06-01 | [.ts](../../src/rules/ebooks/text-spacing-overridable.ts) · [.test.ts](../../src/rules/ebooks/text-spacing-overridable.test.ts) |
| `ariada/ebooks/audio-control-on-autoplay` | 1.4.2 | 9.1.4.2 | §I.5 | Autoplaying `<audio>` / `<video>` must expose `controls` or be `muted` so users can stop sound. | Agonist Development AB | 2026-06-01 | [.ts](../../src/rules/ebooks/audio-control-on-autoplay.ts) · [.test.ts](../../src/rules/ebooks/audio-control-on-autoplay.test.ts) |
| `ariada/ebooks/reading-content-has-lang` | 3.1.1 | 9.3.1.1 | §I.5 | Embedded reading regions (`article`, `role="document"`, `data-reading-content`) must declare a valid BCP-47 `lang` on themselves or an ancestor. | Agonist Development AB | 2026-06-01 | [.ts](../../src/rules/ebooks/reading-content-has-lang.ts) · [.test.ts](../../src/rules/ebooks/reading-content-has-lang.test.ts) |
| `ariada/ebooks/no-positive-tabindex-in-reading` | 2.4.3, 1.3.2 | 9.2.4.3, 9.1.3.2 | §I.5 | Elements inside a reading region must not use a positive `tabindex`, which scrambles the natural reading focus order. | Agonist Development AB | 2026-06-01 | [.ts](../../src/rules/ebooks/no-positive-tabindex-in-reading.ts) · [.test.ts](../../src/rules/ebooks/no-positive-tabindex-in-reading.test.ts) |

## Rule count summary

| Pack | Total rules | Showcase docs | Bullet entries |
|------|-------------|---------------|----------------|
| A — Checkout | 11 | 1 | 10 |
| B — Statement | 10 | 2 | 8 |
| C — Banking | 10 | 2 | 8 |
| E-books | 5 | 0 | 5 |
| **Total** | **36** | **5** | **31** |

## How to read a rule entry

Each rule maps to:

- **WCAG SC** — one or more Success Criteria from WCAG 2.2 (full URL form: `https://www.w3.org/WAI/WCAG22/Understanding/<sc-slug>.html`).
- **EN 301 549** — clauses from the EU harmonised standard v3.2.1 (the WCAG SCs are echoed in EN 301 549 chapter 9; statement requirements are in chapter 12).
- **EAA Annex I** — sectoral hooks from Directive (EU) 2019/882 (Annex I §I.1 general, §I.3 e-commerce, §I.4 banking, §I.5 e-books and dedicated software, §I.7 audiovisual).
- **One-line summary** — what the rule asserts, expressed as a positive requirement.

For full rule semantics, edge cases, locale notes, and provenance of fixtures, see the matching showcase doc when present or the rule source file otherwise.

## Methodology and licensing

How these rules were derived, what was deliberately excluded, and how they relate to upstream axe-core is documented in [METHODOLOGY.md](../METHODOLOGY.md). License rationale and architecture decisions are in [adrs/](../adrs/).
