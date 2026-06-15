// SPDX-License-Identifier: EUPL-1.2
/**
 * Property-based tests for emitVpat (M5 evidence-emitter).
 *
 * Verifies invariants of the VPAT 2.5 JSON output that must hold for any
 * (violations, meta) combination — JSON-serialisability, structural shape,
 * and WCAG SC coverage.
 */

import * as fc from 'fast-check';
import { describe, it, expect } from 'vitest';

import { emitVpat } from '../emit-vpat.js';
import type { Violation, ReportMeta } from '../types.js';
import { WCAG_22_CRITERIA } from '../wcag-22-catalog.js';

const impactArb = fc.constantFrom('minor', 'moderate', 'serious', 'critical') as fc.Arbitrary<
  Violation['impact']
>;

// Constrain WCAG SCs to ones actually in WCAG_22_CRITERIA so the SC-coverage
// property has a well-defined answer (input SCs not in the catalogue are
// silently ignored by emitVpat — see emit-vpat.ts L36-55 bucketViolationsBySc).
const knownScArb = fc.constantFrom(...WCAG_22_CRITERIA.map((c) => c.sc));

const violationArb: fc.Arbitrary<Violation> = fc.record({
  id: fc.constantFrom('color-contrast', 'aria-required-attr', 'label-missing'),
  description: fc.constant('Description'),
  help: fc.constant('Help'),
  impact: impactArb,
  wcag: fc.array(knownScArb, { minLength: 1, maxLength: 3 }),
  nodeCount: fc.integer({ min: 1, max: 50 }),
});

const reportMetaArb: fc.Arbitrary<ReportMeta> = fc.record({
  productName: fc.constantFrom('AcmeShop', 'ExampleBank', 'PublicSite'),
  evaluator: fc.constantFrom('Ariada Scanner', 'Manual Audit'),
  evaluationDate: fc.constantFrom('2026-01-01', '2026-05-17', '2027-06-30'),
  scope: fc.constantFrom('https://example.com', 'whole site'),
});

describe('emitVpat — property tests', () => {
  it('PROP: output is always JSON-serialisable (no circular refs, no functions, no NaN/Infinity)', () => {
    fc.assert(
      fc.property(
        fc.array(violationArb, { maxLength: 20 }),
        reportMetaArb,
        (violations, meta) => {
          const report = emitVpat(violations, meta);
          // Round-trip through JSON.stringify -> JSON.parse — if any field is
          // non-serialisable (function, Symbol, BigInt, circular), this throws.
          const json = JSON.stringify(report);
          expect(typeof json).toBe('string');
          const parsed = JSON.parse(json);
          // Structural sanity — must round-trip equal.
          expect(parsed).toEqual(report);
        },
      ),
      {
        numRuns: 100,
        examples: [
          [
            [],
            {
              productName: 'X',
              evaluator: 'Y',
              evaluationDate: '2026-05-17',
              scope: 'https://x',
            },
          ],
          [
            // single violation hitting every SC bucket path
            [
              {
                id: 'r',
                description: 'd',
                help: 'h',
                impact: 'critical' as const,
                wcag: ['1.1.1', '1.4.3'],
                nodeCount: 10,
              },
            ],
            {
              productName: 'P',
              evaluator: 'E',
              evaluationDate: '2026-05-17',
              scope: 'https://p',
            },
          ],
        ],
      },
    );
  }, 30_000);

  it('PROP: VPAT structural shape — schema URI fixed, criteria has stable cardinality, summary sums to total', () => {
    // The official ITI VPAT 2.5 schema (https://schemas.ariada.org/vpat/2.5.json
    // is a workspace-internal mirror; we don't have it as a runtime JSON Schema
    // file in this package — see TODO in docs/PROPERTY_TESTING.md to wire it
    // up as a follow-up). Instead we assert the structural-shape invariants
    // that any conforming VPAT 2.5 JSON document must satisfy.
    fc.assert(
      fc.property(
        fc.array(violationArb, { maxLength: 20 }),
        reportMetaArb,
        (violations, meta) => {
          const r = emitVpat(violations, meta);

          // Fixed schema metadata
          expect(r.$schema).toBe('https://schemas.ariada.org/vpat/2.5.json');
          expect(r.schemaVersion).toBe('2.5');

          // Criteria cardinality is stable across runs (one row per WCAG_22_CRITERIA entry)
          expect(r.criteria).toHaveLength(WCAG_22_CRITERIA.length);

          // Every criterion has the required keys + valid conformance enum
          const validConformance = new Set([
            'Supports',
            'Partially Supports',
            'Does Not Support',
            'Not Applicable',
            'Not Evaluated',
          ]);
          for (const c of r.criteria) {
            expect(typeof c.criterion).toBe('string');
            expect(typeof c.name).toBe('string');
            expect(['A', 'AA', 'AAA']).toContain(c.level);
            expect(validConformance.has(c.conformance)).toBe(true);
            expect(typeof c.remarks).toBe('string');
          }

          // Summary counts sum to total
          const s = r.summary;
          expect(s.total).toBe(WCAG_22_CRITERIA.length);
          expect(
            s.supports +
              s.partiallySupports +
              s.doesNotSupport +
              s.notApplicable +
              s.notEvaluated,
          ).toBe(s.total);
        },
      ),
      {
        numRuns: 100,
        examples: [
          [
            [],
            {
              productName: 'X',
              evaluator: 'Y',
              evaluationDate: '2026-05-17',
              scope: 'https://x',
            },
          ],
        ],
      },
    );
  }, 30_000);

  it('PROP: every WCAG SC mentioned in input violations appears in the output criteria with non-Supports conformance', () => {
    // For any violation v with wcag SC `s` that exists in WCAG_22_CRITERIA,
    // the corresponding output criterion MUST have conformance != 'Supports'
    // (it should be 'Partially Supports' for minor/moderate, 'Does Not
    // Support' for serious/critical — but never the default 'Supports').
    fc.assert(
      fc.property(
        fc.array(violationArb, { minLength: 1, maxLength: 10 }),
        reportMetaArb,
        (violations, meta) => {
          const r = emitVpat(violations, meta);
          const mentionedScs = new Set<string>();
          for (const v of violations) for (const sc of v.wcag) mentionedScs.add(sc);

          for (const sc of mentionedScs) {
            // Only assert for SCs that exist in the catalogue (others are silently dropped)
            const row = r.criteria.find((c) => c.criterion === sc);
            if (!row) continue;
            expect(row.conformance).not.toBe('Supports');
            expect(row.conformance).not.toBe('Not Evaluated');
            // remarks must reference the violation
            expect(row.remarks.length).toBeGreaterThan(0);
          }
        },
      ),
      {
        numRuns: 100,
        examples: [
          [
            [
              {
                id: 'r1',
                description: 'd',
                help: 'h',
                impact: 'critical' as const,
                wcag: ['1.1.1'],
                nodeCount: 1,
              },
            ],
            {
              productName: 'P',
              evaluator: 'E',
              evaluationDate: '2026-05-17',
              scope: 'https://p',
            },
          ],
        ],
      },
    );
  }, 30_000);
});
