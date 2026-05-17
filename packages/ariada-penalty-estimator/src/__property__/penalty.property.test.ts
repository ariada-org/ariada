// SPDX-License-Identifier: EUPL-1.2
/**
 * Property-based tests for estimatePenalty (M4 penalty-estimator).
 *
 * Verifies invariants that must hold across all (violations, jurisdiction,
 * options) combinations, not just example fixtures.
 *
 * Per @ariada/penalty-estimator README: the result represents EAA / national
 * statutory exposure. We test the monotonicity, cap, and turnover-scaling
 * invariants.
 */

import type { Violation } from '@ariada/evidence-emitter';
import * as fc from 'fast-check';
import { describe, it, expect } from 'vitest';

import { estimatePenalty, listJurisdictions, JURISDICTION_PROFILES } from '../estimate.js';
import type { Jurisdiction } from '../estimate.js';


const jurisdictionArb: fc.Arbitrary<Jurisdiction> = fc.constantFrom(...listJurisdictions());

const impactArb = fc.constantFrom('minor', 'moderate', 'serious', 'critical') as fc.Arbitrary<
  Violation['impact']
>;

// Build a Violation that the estimator can score. We keep the shape minimal
// to focus on the cost-model code paths.
const violationArb: fc.Arbitrary<Violation> = fc.record({
  id: fc.constantFrom('color-contrast', 'aria-required-attr', 'banking/iban'),
  description: fc.constant('Violation description'),
  help: fc.constant('Help text'),
  impact: impactArb,
  wcag: fc.array(fc.constantFrom('1.4.3', '4.1.2', '3.3.2'), { minLength: 1, maxLength: 2 }),
  nodeCount: fc.integer({ min: 1, max: 100 }),
  eaaAnnexI: fc.option(
    fc.array(fc.constantFrom('I.1', 'I.3', 'I.4'), { minLength: 1, maxLength: 2 }),
    { nil: undefined },
  ),
});

const IMPACT_RANK: Record<Violation['impact'], number> = {
  minor: 1,
  moderate: 2,
  serious: 3,
  critical: 4,
};

describe('estimatePenalty — property tests', () => {
  it('PROP: expectedRiskEur is always >= 0 and never exceeds the per-jurisdiction statutory cap', () => {
    fc.assert(
      fc.property(
        fc.array(violationArb, { maxLength: 30 }),
        jurisdictionArb,
        (violations, jurisdiction) => {
          const result = estimatePenalty(violations, jurisdiction);
          expect(result.expectedRiskEur).toBeGreaterThanOrEqual(0);
          // UK has uncapped Equality Act exposure (maxPenaltyEur=0 sentinel
          // means "uncapped"); other jurisdictions have a hard statutory
          // ceiling that the result MUST respect.
          const profile = JURISDICTION_PROFILES[jurisdiction];
          if (profile.maxPenaltyEur > 0) {
            expect(result.expectedRiskEur).toBeLessThanOrEqual(profile.maxPenaltyEur);
          }
        },
      ),
      {
        numRuns: 100,
        examples: [
          [[], 'SE' as const], // empty violations
          [
            // single critical violation in banking sector
            [
              {
                id: 'r',
                description: 'd',
                help: 'h',
                impact: 'critical' as const,
                wcag: ['1.4.3'],
                eaaAnnexI: ['I.4' as const],
                nodeCount: 100,
              },
            ],
            'DE' as const,
          ],
          [[], 'UK' as const], // UK uncapped
        ],
      },
    );
  });

  it('PROP: higher-impact violation set produces >= expectedRiskEur than lower-impact (monotonicity)', () => {
    // For the SAME nodeCount + jurisdiction + sector, escalating a single
    // violation's impact severity must NEVER decrease the estimated penalty.
    // (Equal-output is acceptable; the rank groups minor+moderate vs serious+critical.)
    fc.assert(
      fc.property(
        fc.tuple(impactArb, impactArb),
        jurisdictionArb,
        fc.integer({ min: 1, max: 50 }),
        ([impactA, impactB], jurisdiction, nodeCount) => {
          // Order them so impactLow.rank <= impactHigh.rank
          const [impactLow, impactHigh] =
            IMPACT_RANK[impactA] <= IMPACT_RANK[impactB] ? [impactA, impactB] : [impactB, impactA];
          const mk = (impact: Violation['impact']): Violation => ({
            id: 'fixed',
            description: 'd',
            help: 'h',
            impact,
            wcag: ['1.4.3'],
            nodeCount,
          });
          const low = estimatePenalty([mk(impactLow)], jurisdiction);
          const high = estimatePenalty([mk(impactHigh)], jurisdiction);
          expect(high.expectedRiskEur).toBeGreaterThanOrEqual(low.expectedRiskEur);
        },
      ),
      {
        numRuns: 100,
        examples: [
          [['minor', 'critical'], 'SE', 1],
          [['serious', 'critical'], 'DE', 50],
          [['minor', 'moderate'], 'UK', 10],
        ],
      },
    );
  });

  it('PROP: turnover-scaling never produces a result below the unscaled baseline', () => {
    // When annualTurnoverEur > €10M, the estimator applies a positive scale
    // factor (>= 1). Therefore the with-turnover result must always be
    // GREATER THAN OR EQUAL to the same call without turnover. This is the
    // "no penalty discount for large companies" invariant.
    //
    // CAVEAT: both results are capped at the statutory max. For small fines
    // under cap, the with-turnover figure can EQUAL the without-turnover one
    // only if both saturate the cap; otherwise it's strictly greater. We
    // assert >=.
    fc.assert(
      fc.property(
        fc.array(violationArb, { minLength: 1, maxLength: 10 }),
        jurisdictionArb,
        fc.integer({ min: 10_000_001, max: 5_000_000_000 }), // > €10M triggers scaling
        (violations, jurisdiction, turnover) => {
          const withoutTurnover = estimatePenalty(violations, jurisdiction);
          const withTurnover = estimatePenalty(violations, jurisdiction, {
            annualTurnoverEur: turnover,
          });
          expect(withTurnover.expectedRiskEur).toBeGreaterThanOrEqual(
            withoutTurnover.expectedRiskEur,
          );
          // Also: scaled value still respects statutory cap.
          const profile = JURISDICTION_PROFILES[jurisdiction];
          if (profile.maxPenaltyEur > 0) {
            expect(withTurnover.expectedRiskEur).toBeLessThanOrEqual(profile.maxPenaltyEur);
          }
        },
      ),
      {
        numRuns: 100,
        examples: [
          [
            [
              {
                id: 'r',
                description: 'd',
                help: 'h',
                impact: 'serious' as const,
                wcag: ['1.4.3'],
                nodeCount: 1,
              },
            ],
            'EU' as const,
            10_000_001, // just over threshold — minimum scaling
          ],
          [
            [
              {
                id: 'r',
                description: 'd',
                help: 'h',
                impact: 'critical' as const,
                wcag: ['1.4.3'],
                nodeCount: 50,
              },
            ],
            'DE' as const,
            5_000_000_000, // multinational scale — clamps at 5×
          ],
        ],
      },
    );
  });
});
