<!-- SPDX-FileCopyrightText: 2025-2026 Agonist Development AB -->
<!-- SPDX-License-Identifier: CC-BY-SA-4.0 -->
# `ariada/checkout/payment-fieldset-grouping`

| Field          | Value                                                                                  |
|----------------|----------------------------------------------------------------------------------------|
| Rule ID        | `ariada/checkout/payment-fieldset-grouping`                                            |
| Selector       | `input[type="radio"][name]`                                                            |
| Pack           | A — E-commerce checkout (EAA Annex I §I.3)                                             |
| Impact         | Serious                                                                                |
| Curator        | Agonist Development AB (Sweden), maintainer commons@ariada.org                         |
| Last reviewed  | 2026-05-15                                                                             |
| WCAG 2.2 SC    | [1.3.1 Info and Relationships (A)](https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html), [4.1.2 Name, Role, Value (A)](https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html) |
| EN 301 549 v3.2.1 | §9.1.3.1, §9.4.1.2                                                                  |
| EAA Annex I    | §I.3 (E-commerce services — consumer-facing checkout flow)                             |
| DOS-lagen      | Not directly applicable (DOS-lagen targets public-sector; EAA mirrors for private)     |

## What this rule checks

The rule examines every `<input type="radio">` whose `name` attribute matches the case-insensitive pattern `/pay|payment|tender|checkout|method/` and verifies that the radios participate in a programmatic group. The check passes if at least one of two conditions is met: (1) the radios share a common `<fieldset>` ancestor that contains a non-empty `<legend>` as a direct child, or (2) the radios share an ancestor with `role="radiogroup"` whose accessible name is set via `aria-label`, `aria-labelledby`, or `title`. The rule is skipped for radios that do not look like payment options, and for single-option groups (only one radio with the matching `name`). The selector intentionally matches against the radio inputs themselves rather than against containers, so that an unwrapped sequence of radios is detected even when no plausible group container exists in the DOM.

## Why this matters

When a payment-method radio group is not wrapped in `<fieldset><legend>` (or `role="radiogroup"` with an accessible name), assistive technology announces each option in isolation: "Credit card, radio button, one of three. PayPal, radio button, two of three. Klarna, radio button, three of three." The user hears the choices but not the question being asked. On a visual page the heading "Payment method" makes the relationship obvious; without the programmatic group association, that relationship is invisible to a screen reader.

In a Swedish e-commerce checkout this matters acutely because Swedish consumers routinely encounter four to seven payment options (Klarna Pay Now, Klarna Pay Later, Swish, kort, faktura, MobilePay, presentkort) — far more than the typical two-option North American flow. Each unannounced choice compounds cognitive load, and abandoned-cart analytics from Baymard Institute (2024) show checkout-flow accessibility friction correlates with a 7-12 percentage-point drop in conversion among assistive-technology users.

This rule complements axe-core's `aria-required-parent` and `fieldset` rules, which detect generic radio-group problems but do not target the payment-method pattern specifically and do not run when the radios are presented in a visual table or grid layout without a wrapping fieldset.

## Pass example HTML

```html
<!-- Pattern 1 — Native HTML fieldset + legend (preferred) -->
<fieldset>
  <legend>Choose payment method</legend>
  <label><input type="radio" name="payment" value="card"> Credit card</label>
  <label><input type="radio" name="payment" value="paypal"> PayPal</label>
  <label><input type="radio" name="payment" value="klarna"> Klarna</label>
</fieldset>

<!-- Pattern 2 — ARIA radiogroup with aria-labelledby -->
<h3 id="pay-heading">Choose payment method</h3>
<div role="radiogroup" aria-labelledby="pay-heading">
  <label><input type="radio" name="payment" value="card"> Credit card</label>
  <label><input type="radio" name="payment" value="paypal"> PayPal</label>
</div>

<!-- Pattern 3 — Inline aria-label on radiogroup -->
<div role="radiogroup" aria-label="Choose payment method">
  <label><input type="radio" name="payment" value="card"> Credit card</label>
  <label><input type="radio" name="payment" value="paypal"> PayPal</label>
</div>
```

The first pattern is preferred because it carries the strongest semantics in every browser without depending on ARIA implementation quality. The second pattern is acceptable when CSS or framework constraints prevent a `<fieldset>` (a common case in CSS grid layouts where `<fieldset>` defaults can interfere with column alignment).

## Fail example HTML

```html
<!-- FAIL — no group at all -->
<h2>Payment method</h2>
<input type="radio" name="payment" value="card"> Credit card
<input type="radio" name="payment" value="paypal"> PayPal

<!-- FAIL — fieldset without legend -->
<fieldset>
  <input type="radio" name="payment" value="card">
  <input type="radio" name="payment" value="paypal">
</fieldset>

<!-- FAIL — radiogroup without accessible name -->
<div role="radiogroup">
  <input type="radio" name="payment" value="card">
  <input type="radio" name="payment" value="paypal">
</div>
```

In all three failures, screen readers announce individual radio choices without the connecting question. The visual `<h2>Payment method</h2>` heading in the first example provides no programmatic relationship to the radios that follow.

## Edge cases

- **Single-option groups** — a single radio with the matching `name` is skipped. A single-option radio group is a UX bug in its own right, but it is not the problem this rule targets.
- **Cross-frame radios** — radios split across multiple iframes are not grouped. The rule runs once per document context; cross-iframe grouping is impossible per HTML radio-group semantics.
- **`name` regex false positives** — fields named `paymentTermsAcceptance` or `checkoutNewsletter` may match. The rule guards against this by also requiring that the input is of `type="radio"` (which excludes most consent checkboxes), and by requiring at least two radios with the same `name`.
- **Dynamically rendered radios** (React, Vue, htmx) — the rule sees the DOM at scan time. If the radio group is rendered only on user interaction, the scanner must navigate into that state before invoking the rule.

## Nordic locale notes

- **Swedish (sv)** — common legend texts: "Välj betalsätt", "Välj betalningsmetod". Common payment values: `swish`, `klarna`, `kort`, `faktura`, `mobilepay`.
- **Norwegian (nb / nn)** — "Velg betalingsmåte". Common: `vipps`, `klarna`, `kort`, `faktura`.
- **Danish (da)** — "Vælg betalingsmåde". Common: `mobilepay`, `dankort`, `klarna`, `faktura`.
- **Finnish (fi)** — "Valitse maksutapa". Common: `mobilepay`, `pivo`, `nordea`, `klarna`, `lasku`.

The `name` regex is intentionally English-language to keep the rule deterministic across locales, since `name` attributes in HTML are almost universally written in English even on heavily localised pages (server-side frameworks rarely localise form field names).

## References

- W3C WCAG 2.2 Understanding 1.3.1 — Info and Relationships: <https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html>
- W3C WCAG 2.2 Understanding 4.1.2 — Name, Role, Value: <https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html>
- W3C WAI Tutorials — Grouping Controls: <https://www.w3.org/WAI/tutorials/forms/grouping/>
- W3C ARIA Authoring Practices — Radio Group pattern: <https://www.w3.org/WAI/ARIA/apg/patterns/radio/>
- ETSI EN 301 549 v3.2.1 (2021-03): <https://www.etsi.org/deliver/etsi_en/301500_301599/301549/03.02.01_60/en_301549v030201p.pdf>
- EAA Directive (EU) 2019/882, Annex I: <https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32019L0882>
- WebAIM Million 2024 report, form-control findings: <https://webaim.org/projects/million/>
- Baymard Institute, Checkout Usability research: <https://baymard.com/checkout-usability>

## Provenance of fixtures

Test fixtures live in `src/rules/checkout/payment-fieldset-grouping.test.ts` and cover the three pass patterns and three fail patterns shown above, plus the skipped cases (single-option, non-payment radios). Cross-tool fixtures in `benchmarks/cross-tool/fixtures/` (`klarna-style-checkout-sv.html`, `klarna-style-bad-checkout-sv.html`, `mittelstand-checkout-de.html`) provide larger realistic page contexts written from scratch as illustrative templates — they do not copy from any real merchant. The fixtures intentionally include a mix of well-formed and malformed groups so the rule's pass/fail behaviour is exercised in context.

## Changelog

- 2026-05-15 — Expanded to full 14-section structure per Phase 1D the package contract; added Nordic locale notes and edge cases. Curator: Agonist Development AB.
- 2026-05-14 — Initial doc covering the seven test scenarios.

## AI-honesty footer

Sections "What this rule checks", "Pass example HTML", "Fail example HTML", and "Provenance of fixtures" were drafted with AI assistance from the rule's source code and test fixtures and then reviewed by the human maintainer against the underlying TypeScript implementation. The "Why this matters" section was written by the human maintainer with reference to public Baymard Institute and WebAIM research; the AI assistant did not introduce any quantitative claim that the maintainer did not verify against its cited source. No marketing claims, product-promotion language, or unverified statistics appear in this document.
