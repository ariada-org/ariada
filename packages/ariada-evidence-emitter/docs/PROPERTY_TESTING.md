# Property-Based Testing — @ariada/evidence-emitter

This package uses [fast-check](https://github.com/dubzzz/fast-check) for
property-based testing in addition to the example-based unit tests under
`src/emit-vpat.test.ts`, `src/emit-en301549.test.ts`,
`src/emit-dos-lagen.test.ts`.

**Run:** `pnpm test:property`

**Location:** `src/__property__/`

## Invariants tested

### `src/__property__/vpat.property.test.ts`

1. **`emitVpat(violations, meta)` output is always JSON-serialisable** —
   round-trips through `JSON.stringify` / `JSON.parse` and the parsed
   value equals the original. Catches any accidental introduction of
   non-serialisable values (functions, Symbol, BigInt, circular refs,
   NaN/Infinity).
2. **VPAT 2.5 structural shape** — schema URI is the fixed
   `https://schemas.ariada.org/vpat/2.5.json`, schemaVersion is `'2.5'`,
   criteria array length matches `WCAG_22_CRITERIA` cardinality (87 SCs
   as of W3C Rec 2026-10-05), every criterion has a valid `conformance`
   enum value, and the summary counts sum to total.
3. **Every WCAG SC mentioned in input violations appears in the output
   criteria with non-`Supports` conformance** — for any violation `v`
   with WCAG SC `s` that exists in the catalogue, the corresponding
   output row must have `conformance ∈ {'Partially Supports', 'Does Not
   Support'}` (never the default `'Supports'`). SCs absent from the
   catalogue (`WCAG_22_CRITERIA`) are silently dropped per emit-vpat.ts
   bucketing logic — these are excluded from the assertion.

## Note on the official VPAT 2.5 JSON Schema

The full VPAT 2.5 JSON Schema (published by ITI) is not currently
bundled as a runtime asset in this package. The structural-shape
property test above asserts the contract the codebase implements
internally. Follow-up: wire up `ajv` against
`https://schemas.ariada.org/vpat/2.5.json` once the schema is published
to ariada.org/schemas.

## Findings

No property violations discovered.

## How to add a new property test

1. Decide the **invariant** that should hold for ALL inputs.
2. Use `knownScArb = fc.constantFrom(...WCAG_22_CRITERIA.map(c => c.sc))`
   to constrain WCAG SCs to ones the emitter actually handles. (Random
   SC strings are silently dropped — would lead to misleading test
   results otherwise.)
3. Pass `numRuns: 100` and include explicit `examples:` covering empty
   violations + single critical-impact violation.

If a property fails:
- DO NOT modify `emit-vpat.ts` (or sibling emitters) to make the test pass.
- Decide whether the property statement was wrong (refine it) or
  production code has a real bug (file a follow-up ticket).

## Future work

- Add property tests for `emitEn301549` and `emitDosLagen` (parallel
  structure to vpat).
- Add a property test that JSON-Schema-validates the emitted document
  against the official ITI VPAT 2.5 schema once it lands at
  `schemas.ariada.org/vpat/2.5.json`.

## See also

- Sibling: `packages/wcag-rules-extended/docs/PROPERTY_TESTING.md`
- [fast-check tutorial](https://fast-check.dev/docs/tutorials/)
