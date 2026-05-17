# Property-Based Testing — @ariada/penalty-estimator

This package uses [fast-check](https://github.com/dubzzz/fast-check) for
property-based testing in addition to the example-based unit tests at
`src/penalty.test.ts`.

**Run:** `pnpm test:property`

**Location:** `src/__property__/`

## Invariants tested

### `src/__property__/penalty.property.test.ts`

1. **`expectedRiskEur` is always ≥ 0 AND ≤ statutory cap per jurisdiction**
   — across all 11 jurisdictions (SE/NO/DK/FI/DE/FR/NL/AT/CH/UK/EU) with
   random violation sets up to 30 entries. UK uses uncapped Equality Act
   exposure (`maxPenaltyEur === 0` sentinel) so the cap assertion is
   skipped for UK.
2. **Higher-impact violation produces ≥ result than lower-impact
   (monotonicity)** — for the same `nodeCount` + jurisdiction + sector,
   escalating a single violation's impact severity from `minor` →
   `moderate` → `serious` → `critical` must NEVER decrease the estimated
   penalty.
3. **Turnover-scaling never produces a result below the unscaled baseline
   AND still respects the statutory cap** — for any turnover > €10M (the
   scaling threshold per `estimate.ts:310`), the with-turnover result is
   ≥ the without-turnover result, and both saturate at the jurisdiction
   maxPenaltyEur where applicable.

## Note on the "≤ 4 % of turnover" property

The task brief mentioned testing that "turnover-scaled fine never exceeds
4 % of turnover (per EU regulation max)". This invariant is NOT
implemented in the current estimator — the codebase uses a 1×–5×
multiplier on `baseExposure`, NOT a hard 4 % cap on turnover. The DSA
art. 35 4 % rule is a separate statutory ceiling that would require a
production code change to enforce. Per our property-testing discipline,
property tests must NOT drive production changes; they must verify
invariants the code actually intends to hold. The 4 % ceiling is
tracked as a follow-up enhancement.

## Findings

No property violations discovered.

## How to add a new property test

1. Decide the **invariant** that should hold for ALL inputs.
2. Use `JURISDICTION_PROFILES` to derive expected bounds (e.g., per-jurisdiction
   `maxPenaltyEur`, `seriousMultiplier`).
3. Use `numRuns: 100` and include explicit `examples:` covering UK (uncapped),
   SE/FI (€1M cap), DE (€100k cap), EU (€35M cap).

If a property fails:
- DO NOT modify `estimate.ts` just to make the test pass.
- Decide whether the property statement was wrong (refine it) or
  production code has a real bug (file a follow-up ticket).

## See also

- Sibling: `packages/wcag-rules-extended/docs/PROPERTY_TESTING.md`
- [fast-check tutorial](https://fast-check.dev/docs/tutorials/)
