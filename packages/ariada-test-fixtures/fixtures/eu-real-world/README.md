# EU real-world test fixtures

Synthetic-but-plausible HTML fixtures representing common EU SMB patterns
across Nordic, German, and French markets. Used by integration tests to
verify Pack A (checkout) / Pack B (statement) / Pack C (banking + locale)
rules trigger correctly on realistic markup.

## Provenance

All fixtures are **original synthetic content** authored for this package.
No real-world page HTML is copied from any production site. Brand-style
references (Klarna, BankID, MobilePay) are illustrative of the pattern
category; they do not imitate any vendor's actual UI markup.

License: **CC0-1.0** (public domain dedication). See `LICENSE` at the
repository root for the project's primary EUPL-1.2 license that governs
the package source.

## Fixture index

### Nordic e-commerce checkout (Swedish)

- `klarna-style-cart-sv.html` — Cart page with quantity inputs, totals,
  Swedish locale (kr formatting), discount-code section
- `klarna-style-checkout-sv.html` — Multi-step checkout: shipping →
  payment-method radios (kort / Swish / Klarna delbetalning) → review
- `klarna-style-order-confirmation-sv.html` — Order confirmation with
  focus-target heading
- `klarna-style-bad-checkout-sv.html` — FAIL fixture: missing payment
  fieldset grouping, missing autocomplete on personal-data inputs

### Nordic banking — Swedish BankID-style flow

- `bankid-style-sso-redirect-sv.html` — Identification page with BankID
  launch button (label localised)
- `bankid-style-2fa-challenge-sv.html` — 2FA challenge with QR code,
  numeric input fallback, session timeout warning
- `bankid-style-success-sv.html` — Authentication success page

### Nordic banking — Danish MobilePay-style merchant flow

- `mobilepay-style-merchant-checkout-da.html` — Merchant checkout with
  amount in DKK, recipient details
- `mobilepay-style-authentication-da.html` — User authentication step
  with biometric / PIN fallback
- `mobilepay-style-bad-merchant-da.html` — FAIL fixture: missing
  language tag, untranslated error message

### Public-sector accessibility statements

- `accessibility-statement-fi.html` — Finnish public-sector statement
  page following Avi mall (good-quality example)
- `accessibility-statement-fi-incomplete.html` — Same page with missing
  enforcement-procedure link + missing methodology (FAIL fixture)

### German Mittelstand e-commerce

- `mittelstand-checkout-de.html` — Mid-size B2B e-commerce checkout
  (Rechnungsanschrift / Lieferanschrift) with German autocomplete
  attribute names
- `mittelstand-bad-checkout-de.html` — FAIL fixture: missing fieldset
  grouping for payment methods (Rechnung / Vorkasse / SEPA-Lastschrift /
  Kreditkarte), placeholder used as label

### French RGAA statement

- `rgaa-statement-fr.html` — French RGAA-format déclaration
  d'accessibilité (good-quality example)
- `rgaa-statement-fr-incomplete.html` — FAIL fixture: missing date
  of evaluation, missing organisation contact

## Fixture conventions

Every fixture starts with a comment block declaring:

```html
<!--
  Fixture: <name>
  Pattern: <real-world pattern category>
  Status: PASS | FAIL | MIXED
  Expected rules to fire: <comma-separated rule IDs (FAIL only)>
  License: CC0-1.0
  Provenance: original synthetic content (no vendor markup copied)
-->
```

The license header is mandatory. Fixtures without it must not be merged.

## Adding fixtures

1. Choose a real-world category not yet covered.
2. Author 30-200 lines of HTML representing the pattern (PASS or FAIL).
3. Add the standard comment header.
4. Add an entry to this README under the appropriate section.
5. Add an integration test in `test/integration/` that loads the fixture
   and asserts expected rule outcomes.
6. Open a PR with `[fixture]` prefix.

## Integration testing

These fixtures are loaded into happy-dom via the test helper:

```ts
import { loadFixture } from '../utils.js';

const doc = loadFixture('eu-real-world/klarna-style-cart-sv.html');
const results = await axe.run(doc); // hypothetical
```

(Integration test harness lives in `test/integration/` — separate from
the per-rule unit tests in `src/rules/*/*.test.ts`.)
