// SPDX-License-Identifier: EUPL-1.2
/**
 * Tests for EAA penalty estimator.
 */

import type { Violation } from '@ariada-org/evidence-emitter';
import { describe, it, expect } from 'vitest';

import { estimatePenalty, JURISDICTION_PROFILES, listJurisdictions } from './estimate.js';

import * as publicApi from './index.js';

const ONE_SERIOUS: Violation[] = [
  {
    id: 'color',
    description: 'color',
    help: 'color',
    impact: 'serious',
    wcag: ['1.4.3'],
    nodeCount: 1,
  },
];

const CRITICAL_BANK: Violation[] = [
  {
    id: 'block',
    description: 'block',
    help: 'block',
    impact: 'critical',
    wcag: ['2.1.1', '4.1.2'],
    eaaAnnexI: ['I.4'],
    nodeCount: 8,
  },
];

describe('estimatePenalty', () => {
  it('returns zero for empty violations list', () => {
    const r = estimatePenalty([], 'SE');
    expect(r.expectedRiskEur).toBe(0);
    expect(r.maxPenaltyEur).toBeGreaterThan(0); // SE cap = 1M EUR
    expect(r.jurisdiction).toBe('SE');
  });

  it('UK uncapped — maxPenaltyEur equals modelled exposure (no statutory ceiling)', () => {
    const r = estimatePenalty(CRITICAL_BANK, 'UK');
    expect(r.maxPenaltyEur).toBeGreaterThan(0);
    expect(r.expectedRiskEur).toBe(r.maxPenaltyEur);
  });

  it('SE — DOS-lagen + DIGG: returns positive risk with one serious violation', () => {
    const r = estimatePenalty(ONE_SERIOUS, 'SE');
    expect(r.expectedRiskEur).toBeGreaterThan(0);
    expect(r.maxPenaltyEur).toBeGreaterThanOrEqual(r.expectedRiskEur);
    expect(r.lawReferences.length).toBeGreaterThan(0);
    expect(r.lawReferences.some((l) => /lag 2018:1937|DOS-lagen/i.test(l))).toBe(true);
  });

  it('DE — BFSG cap kicks in for critical banking violations (statutory clamp visible)', () => {
    const deR = estimatePenalty(CRITICAL_BANK, 'DE');
    // BFSG §37 caps single infringements at €100k — raw modelled exposure for
    // 8-node critical banking violation exceeds this, so capping must apply.
    expect(deR.expectedRiskEur).toBeLessThanOrEqual(100_000);
    expect(deR.maxPenaltyEur).toBe(100_000);
    expect(deR.lawReferences.some((l) => /BFSG/i.test(l))).toBe(true);
  });

  it('UK — Equality Act 2010 + EHRC: returns GBP-equivalent in EUR', () => {
    const r = estimatePenalty(CRITICAL_BANK, 'UK');
    expect(r.lawReferences.some((l) => /equality act/i.test(l))).toBe(true);
    expect(r.expectedRiskEur).toBeGreaterThan(0);
  });

  it('EU at-large: aggregates exposure (assumes service offered EU-wide)', () => {
    const oneJur = estimatePenalty(CRITICAL_BANK, 'SE');
    const euAtLarge = estimatePenalty(CRITICAL_BANK, 'EU');
    expect(euAtLarge.maxPenaltyEur).toBeGreaterThan(oneJur.maxPenaltyEur);
  });

  it('banking violations carry sector multiplier in I.4 jurisdictions', () => {
    const bankingViolations: Violation[] = [
      { ...CRITICAL_BANK[0]!, eaaAnnexI: ['I.4'] },
    ];
    const ecommerceViolations: Violation[] = [
      { ...CRITICAL_BANK[0]!, eaaAnnexI: ['I.3'] },
    ];
    const bank = estimatePenalty(bankingViolations, 'DE');
    const shop = estimatePenalty(ecommerceViolations, 'DE');
    expect(bank.expectedRiskEur).toBeGreaterThanOrEqual(shop.expectedRiskEur);
  });

  it('returns explanation array with concrete cited amounts', () => {
    const r = estimatePenalty(ONE_SERIOUS, 'DE');
    expect(r.explanation.length).toBeGreaterThan(0);
    expect(r.explanation.some((line) => /€|EUR/.test(line))).toBe(true);
  });

  it('throws on unknown jurisdiction', () => {
    // @ts-expect-error — testing invalid input
    expect(() => estimatePenalty(ONE_SERIOUS, 'XX')).toThrow();
  });

  it('respects custom turnover multiplier', () => {
    const r = estimatePenalty(CRITICAL_BANK, 'DE', { annualTurnoverEur: 100_000_000 });
    expect(r.expectedRiskEur).toBeGreaterThan(0);
  });

  it('all 11 jurisdictions are present in catalogue', () => {
    const codes = listJurisdictions();
    for (const code of ['SE', 'NO', 'DK', 'FI', 'DE', 'FR', 'NL', 'AT', 'CH', 'UK', 'EU']) {
      expect(codes).toContain(code);
    }
  });

  it('JURISDICTION_PROFILES entries have required fields', () => {
    for (const code of listJurisdictions()) {
      const p = JURISDICTION_PROFILES[code];
      expect(p, `Profile for ${code}`).toBeDefined();
      // UK is statutorily uncapped under Equality Act 2010 — maxPenaltyEur=0 signals that.
      expect(p?.maxPenaltyEur).toBeGreaterThanOrEqual(0);
      expect(p?.baseFineEur).toBeGreaterThan(0);
      expect(p?.lawReferences.length).toBeGreaterThan(0);
      expect(p?.authority.length).toBeGreaterThan(0);
    }
  });

  it('turnover scaling clamp — caps multiplier at ×5 even for very large turnover', () => {
    // Very large turnover (€1B) would otherwise produce ×11 multiplier — clamp to ×5
    const small = estimatePenalty(CRITICAL_BANK, 'UK', { annualTurnoverEur: 50_000_000 });
    const huge = estimatePenalty(CRITICAL_BANK, 'UK', { annualTurnoverEur: 1_000_000_000 });
    // The ratio between huge / small must reflect the clamp — without clamp it would be ~10×,
    // with clamp ×5 / ×1.5 ≈ 3.3×
    expect(huge.expectedRiskEur / small.expectedRiskEur).toBeLessThan(5);
    expect(huge.expectedRiskEur).toBeGreaterThan(small.expectedRiskEur);
    expect(huge.explanation.some((line) => /Turnover scaling: ×5/.test(line))).toBe(true);
  });

  it('custom enforcementFactor override changes risk linearly', () => {
    const half = estimatePenalty(CRITICAL_BANK, 'UK', { enforcementFactor: 0.2 });
    const full = estimatePenalty(CRITICAL_BANK, 'UK', { enforcementFactor: 0.4 });
    // 0.4 / 0.2 == 2× risk
    expect(full.expectedRiskEur / half.expectedRiskEur).toBeCloseTo(2, 1);
  });
});

describe('public API surface (./index.js barrel)', () => {
  it('re-exports estimatePenalty as a callable function', () => {
    expect(typeof publicApi.estimatePenalty).toBe('function');
    const r = publicApi.estimatePenalty([], 'SE');
    expect(r.jurisdiction).toBe('SE');
  });

  it('re-exports listJurisdictions returning the full 11-country set', () => {
    expect(typeof publicApi.listJurisdictions).toBe('function');
    expect(publicApi.listJurisdictions()).toHaveLength(11);
  });

  it('re-exports JURISDICTION_PROFILES record', () => {
    expect(publicApi.JURISDICTION_PROFILES.SE?.code).toBe('SE');
  });
});

// Wave 2 expansion (LAGRANGE) — per-jurisdiction × severity × turnover matrix

describe('estimatePenalty — per-jurisdiction × severity matrix', () => {
  const jurisdictions = ['SE', 'NO', 'DK', 'FI', 'DE', 'FR', 'NL', 'AT', 'CH', 'UK', 'EU'] as const;
  const impacts = ['minor', 'moderate', 'serious', 'critical'] as const;

  for (const jur of jurisdictions) {
    for (const impact of impacts) {
      it(`${jur} × ${impact}: returns non-negative risk and lawful refs`, () => {
        const v: Violation[] = [
          { id: 'x', description: 'x', help: 'x', impact, wcag: ['1.4.3'], nodeCount: 1 },
        ];
        const r = estimatePenalty(v, jur);
        expect(r.expectedRiskEur).toBeGreaterThanOrEqual(0);
        expect(r.jurisdiction).toBe(jur);
        expect(r.lawReferences.length).toBeGreaterThan(0);
      });
    }
  }
});

describe('estimatePenalty — turnover tier matrix', () => {
  const tiers = [
    { name: 'micro', turnover: 1_000_000 },
    { name: 'small', turnover: 10_000_000 },
    { name: 'medium', turnover: 100_000_000 },
  ];

  for (const tier of tiers) {
    it(`SE / ${tier.name} (€${tier.turnover.toLocaleString()}) — non-negative risk`, () => {
      const r = estimatePenalty(CRITICAL_BANK, 'SE', { annualTurnoverEur: tier.turnover });
      expect(r.expectedRiskEur).toBeGreaterThanOrEqual(0);
    });

    it(`DE / ${tier.name} — capped by BFSG €100k regardless of turnover`, () => {
      const r = estimatePenalty(CRITICAL_BANK, 'DE', { annualTurnoverEur: tier.turnover });
      expect(r.expectedRiskEur).toBeLessThanOrEqual(100_000);
    });
  }
});

describe('estimatePenalty — boundary cases', () => {
  it('handles 100+ violations (large dataset)', () => {
    const v: Violation[] = Array.from({ length: 100 }, (_, i) => ({
      id: `r${i}`,
      description: `D${i}`,
      help: 'fix',
      impact: 'serious' as const,
      wcag: ['1.4.3'],
      nodeCount: 1,
    }));
    const r = estimatePenalty(v, 'SE');
    expect(r.expectedRiskEur).toBeGreaterThan(0);
  });

  it('handles zero-node-count violations', () => {
    const v: Violation[] = [
      { id: 'x', description: 'x', help: 'x', impact: 'serious', wcag: ['1.4.3'], nodeCount: 0 },
    ];
    const r = estimatePenalty(v, 'SE');
    expect(r.expectedRiskEur).toBeGreaterThanOrEqual(0);
  });

  it('handles violation with very large nodeCount (10k)', () => {
    const v: Violation[] = [
      { id: 'x', description: 'x', help: 'x', impact: 'critical', wcag: ['1.4.3'], nodeCount: 10_000 },
    ];
    const r = estimatePenalty(v, 'SE');
    expect(r.expectedRiskEur).toBeGreaterThan(0);
    // SE cap applies.
    expect(r.expectedRiskEur).toBeLessThanOrEqual(r.maxPenaltyEur);
  });

  it('handles violation with no eaaAnnexI (no sector multiplier)', () => {
    const v: Violation[] = [
      { id: 'x', description: 'x', help: 'x', impact: 'serious', wcag: ['1.4.3'] },
    ];
    const r = estimatePenalty(v, 'DE');
    expect(r.expectedRiskEur).toBeGreaterThanOrEqual(0);
  });

  it('respects custom enforcementFactor=0 (zero risk)', () => {
    const r = estimatePenalty(CRITICAL_BANK, 'UK', { enforcementFactor: 0 });
    expect(r.expectedRiskEur).toBe(0);
  });

  it('respects custom enforcementFactor=1 (full risk)', () => {
    const r = estimatePenalty(CRITICAL_BANK, 'UK', { enforcementFactor: 1 });
    expect(r.expectedRiskEur).toBeGreaterThan(0);
  });

  it('zero turnover defaults to base scaling', () => {
    const r = estimatePenalty(CRITICAL_BANK, 'DE', { annualTurnoverEur: 0 });
    expect(r.expectedRiskEur).toBeGreaterThanOrEqual(0);
  });

  it('mixed-impact set returns same or higher than minor-only', () => {
    const minorOnly: Violation[] = [
      { id: 'x', description: 'x', help: 'x', impact: 'minor', wcag: ['1.4.3'] },
    ];
    const mixed: Violation[] = [
      ...minorOnly,
      { id: 'y', description: 'y', help: 'y', impact: 'critical', wcag: ['2.1.1'] },
    ];
    const minorR = estimatePenalty(minorOnly, 'SE');
    const mixedR = estimatePenalty(mixed, 'SE');
    expect(mixedR.expectedRiskEur).toBeGreaterThanOrEqual(minorR.expectedRiskEur);
  });
});