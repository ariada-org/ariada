# Property-Based Testing — @ariada/statement-generator

This package uses [fast-check](https://github.com/dubzzz/fast-check) for
property-based testing in addition to the example-based unit tests under
`src/generate.test.ts`.

**Run:** `pnpm test:property`

**Location:** `src/__property__/`

## Invariants tested

### `src/__property__/generate.property.test.ts`

1. **`generateStatement(violations, meta, options)` never throws** regardless
   of `violations[]` shape, locale, jurisdiction, or format. Fuzzes the
   full cross-product of Nordic 4 + English locales × {SE, NO, DK, FI}
   jurisdictions × {html, mdx} formats with up to 20 random violations.
2. **HTML output well-formedness** — count of `<section …>` opening tags
   equals count of `</section>` closing tags AND ≥ 3 (the legally required
   minimum: standards, feedback, enforcement per Directive 2016/2102 art. 7).
3. **Body length is monotonic in violation count** — adding more violations
   to the same base set never SHRINKS the output. Catches accidental
   dedup/truncation regressions.

## Findings

No property violations discovered. The example-based tests at
`src/generate.test.ts` (51 tests) cover specific locale/jurisdiction/format
combinations; these property tests give us confidence that the cartesian
product of inputs is safe too.

## How to add a new property test

1. Decide the **invariant** that should hold for ALL inputs (not just one).
2. Build `fc.Arbitrary`s for the input. Use the existing `violationArb`,
   `reportMetaArb` arbitraries as starting points.
3. Constrain string arbitraries to avoid unpaired surrogates
   (`.filter((s) => !/[\uD800-\uDFFF]/.test(s))`) — happy-dom and many
   HTML parsers reject them.
4. Pass `numRuns: 100` (default — sufficient for most invariants).
5. Include at least 1 explicit `examples: [[…edge case…]]` entry covering
   empty violations, max-severity violations, leap-year dates, etc.

If a property fails:
- DO NOT modify production code in `generate.ts` just to make the test pass.
- Inspect the shrunk counter-example fast-check reports.
- Decide whether the property statement was wrong (refine it) or
  production code has a real bug (file a follow-up ticket).

## See also

- Sibling: `packages/wcag-rules-extended/docs/PROPERTY_TESTING.md`
- [fast-check tutorial](https://fast-check.dev/docs/tutorials/)
