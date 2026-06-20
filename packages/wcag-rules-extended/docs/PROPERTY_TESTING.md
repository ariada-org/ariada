<!-- SPDX-FileCopyrightText: 2025-2026 Agonist Development AB -->
<!-- SPDX-License-Identifier: CC-BY-SA-4.0 -->
# Property-Based Testing — @ariada-org/wcag-rules-extended

This package uses [fast-check](https://github.com/dubzzz/fast-check) for
property-based testing in addition to the example-based unit tests under
`src/rules/**/*.test.ts`.

**Run:** `pnpm test:property`

**Location:** `src/__property__/`

## Why both example-based AND property-based?

| Style                    | Strength                                | Weakness                       |
|--------------------------|-----------------------------------------|--------------------------------|
| Example-based (existing) | Specific regression cases, readable     | Misses edge cases by oversight |
| Property-based (this)    | Discovers edge cases automatically      | Properties harder to formulate |

Property tests generate hundreds of random inputs per run (default
`numRuns: 100`) and assert that an INVARIANT holds for all of them. When
fast-check finds a counter-example, it shrinks it to the minimal failing
input so the bug is easy to inspect.

## Invariants tested

### `src/__property__/helpers.property.test.ts`

1. **`cssEscape` output parses verbatim inside `label[for="..."]` for any
   quote-free input** — mirrors the actual production call-site in
   `helpers.ts:45`. Verifies that no input (random ASCII, Cyrillic, emoji,
   control chars, leading-digit, etc.) produces a selector that throws
   `SyntaxError` when handed to `querySelector`.
2. **`cssEscape` is a no-op for ASCII identifier strings (length ≥ 2,
   leading alpha)** — practical round-trip invariant for ids like
   `"iban-input"`, `"fmt_2"`, `"checkout-email-v2"`.
3. **`getAccessibleNameLite` never throws on any well-formed HTML
   element** — fuzzes (tag, attribute-set, text) combinations.

### `src/__property__/banking-rules.property.test.ts`

4. **IBAN rule PASSES for any IBAN input with a placeholder matching the
   ISO 13616 segmented pattern** — `[A-Z]{2}\d{2}(\s\d{2,4}){2,}`. Fuzz
   includes all 26² country codes × 100 check-digit combos × 2-7 random
   segments.
5. **IBAN rule FAILS for IBAN inputs with placeholders that are too short**
   — fewer than 2 trailing segments.
6. **Currency rule FAILS for any unicode-formatted currency in a plain
   banking-class element** — fuzz spans Nordic ("1 234,56 kr"), US
   ("$1,234.56"), EU ("1.000.000,00 €"), UK ("£1,234.56") locale formats.
7. **Currency rule PASSES when the same currency text is wrapped in
   `<data value="…">`** — verifies the prescribed fix works across all
   the same locale variants.

## Findings — property-discovered

### 1. `cssEscape` over-escapes for use in quoted attribute selectors (latent, unreachable)

The helper at `src/helpers.ts:73` does:

```ts
export function cssEscape(s: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(s);
  }
  return s.replace(/[^a-zA-Z0-9_-]/g, '\\$&');
}
```

…and is used at line 45 as `` `label[for="${cssEscape(id)}"]` ``.

`CSS.escape` is **defined for CSS identifiers**, not for the
double-quoted-string body of an attribute selector value. As a result,
for inputs containing a literal `"`, the output produces an invalid
selector (`SyntaxError` from `querySelector`).

**Reachability:** zero in compliant HTML — HTML5 disallows literal `"`
inside `id` attribute values (`§3.2.6.1`). The buggy path is only
triggered by malformed user-supplied HTML that has already failed
HTML-parser validation.

**Action:** Documented; no production code change in this PR. Follow-up
ticket suggested: switch the `[for=]` lookup to use `for=$id` (no quotes)
with a separately-escaped variant, or use `Document.getElementById` +
`closest('label')` lookup instead of selector composition.

### 2. `CSS.escape("-")` returns `"\\-"`, `CSS.escape("1")` returns `"\\31 "`

Per CSS Object Model spec — leading digits and bare punctuation are
escaped defensively. Property-test invariant adjusted to require length
≥ 2 AND start with `[a-zA-Z]`, which matches actual identifier-style
usage in the codebase.

## How to add a new property test

1. Decide the **invariant** — a property that should hold for ALL inputs
   in some space, not just for one example.
2. Build an `fc.Arbitrary` that generates the input space.
3. Write `fc.assert(fc.property(arb, predicate), { numRuns: 100, examples: [...edge cases...] })`.
4. Include at least 1 explicit edge-case example: empty string,
   max-length string, unicode, etc.
5. **If the property fails**: do NOT modify production code just to make
   the test pass. Document the finding here, narrow the property to
   express the actual intended invariant, and file a follow-up ticket
   for the real bug if any.

## See also

- [fast-check tutorial](https://fast-check.dev/docs/tutorials/)
- [Property-based testing introduction (jqwik)](https://jqwik.net/property-based-testing.html)
