// SPDX-License-Identifier: EUPL-1.2
/**
 * Property-based tests for generateStatement (M3 statement-generator).
 *
 * Verifies invariants that must hold for every (violations, meta, options)
 * combination — not just the example fixtures.
 */

import type { Violation, ReportMeta } from '@ariada-org/evidence-emitter';
import * as fc from 'fast-check';
import { describe, it, expect } from 'vitest';

import { generateStatement } from '../generate.js';
import type { StatementJurisdiction, StatementFormat } from '../generate.js';
import type { Locale } from '../types.js';


const localeArb: fc.Arbitrary<Locale> = fc.constantFrom('en', 'sv', 'nb', 'da', 'fi');
const jurisdictionArb: fc.Arbitrary<StatementJurisdiction> = fc.constantFrom('SE', 'NO', 'DK', 'FI');
const formatArb: fc.Arbitrary<StatementFormat> = fc.constantFrom('html', 'mdx');
const impactArb = fc.constantFrom('minor', 'moderate', 'serious', 'critical') as fc.Arbitrary<
  Violation['impact']
>;
const wcagScArb = fc.constantFrom('1.1.1', '1.3.1', '1.4.3', '2.1.1', '2.4.7', '3.3.2', '4.1.2');

// Arbitrary safe string for free-text fields — avoids surrogate halves
// (happy-dom rejects unpaired surrogates) and limits length.
const safeTextArb = fc
  .string({ minLength: 0, maxLength: 80 })
  .filter((s) => !/[\uD800-\uDFFF]/.test(s));

const violationArb: fc.Arbitrary<Violation> = fc.record({
  id: safeTextArb.filter((s) => s.length > 0),
  description: safeTextArb,
  help: safeTextArb,
  impact: impactArb,
  wcag: fc.array(wcagScArb, { minLength: 1, maxLength: 3 }),
  nodeCount: fc.integer({ min: 1, max: 50 }),
});

const reportMetaArb: fc.Arbitrary<ReportMeta> = fc.record({
  productName: safeTextArb.filter((s) => s.length > 0),
  productVersion: fc.option(safeTextArb, { nil: undefined }),
  evaluator: safeTextArb.filter((s) => s.length > 0),
  evaluationDate: fc.constantFrom(
    '2026-01-15',
    '2026-05-17',
    '2027-12-31',
    '2026-02-29', // leap year edge
  ),
  scope: fc.constantFrom('https://example.com', 'https://example.com/app', 'whole site'),
  methodology: fc.option(safeTextArb, { nil: undefined }),
});

const optionsArb = (
  locale: Locale,
  jurisdiction: StatementJurisdiction,
  format: StatementFormat,
) =>
  fc.record({
    locale: fc.constant(locale),
    jurisdiction: fc.constant(jurisdiction),
    format: fc.constant(format),
    authorityEmail: fc.constant('accessibility@example.com'),
    organisation: safeTextArb.filter((s) => s.length > 0),
    feedbackUrl: fc.constant('https://example.com/feedback'),
  });

describe('generateStatement — property tests', () => {
  it('PROP: never throws regardless of (violations, meta, options) shape', () => {
    fc.assert(
      fc.property(
        fc.array(violationArb, { maxLength: 20 }),
        reportMetaArb,
        localeArb,
        jurisdictionArb,
        formatArb,
        (violations, meta, locale, jurisdiction, format) => {
          const options = {
            locale,
            jurisdiction,
            format,
            authorityEmail: 'accessibility@example.com',
            organisation: 'Example Org',
            feedbackUrl: 'https://example.com/feedback',
          };
          expect(() => generateStatement(violations, meta, options)).not.toThrow();
        },
      ),
      {
        numRuns: 100,
        examples: [
          [
            [], // empty violations
            {
              productName: 'X',
              evaluator: 'Y',
              evaluationDate: '2026-05-17',
              scope: 'https://x',
            },
            'en' as const,
            'SE' as const,
            'html' as const,
          ],
          [
            // single critical violation
            [
              {
                id: 'r',
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
            'fi' as const,
            'FI' as const,
            'mdx' as const,
          ],
        ],
      },
    );
  });

  it('PROP: HTML output has matching opening/closing <section> tags (well-formedness invariant)', () => {
    fc.assert(
      fc.property(
        fc.array(violationArb, { maxLength: 10 }),
        reportMetaArb,
        localeArb,
        jurisdictionArb,
        (violations, meta, locale, jurisdiction) => {
          const result = generateStatement(violations, meta, {
            locale,
            jurisdiction,
            format: 'html',
            authorityEmail: 'a@example.com',
            organisation: 'Org',
            feedbackUrl: 'https://example.com/fb',
          });
          // Count <section ... > opens and </section> closes. Use a tolerant
          // regex that doesn't span lines greedily.
          const opens = (result.body.match(/<section\b[^>]*>/g) ?? []).length;
          const closes = (result.body.match(/<\/section>/g) ?? []).length;
          expect(opens).toBe(closes);
          // Should be at least 3 sections in any non-empty statement
          // (standards, feedback, enforcement) per Directive 2016/2102 art. 7.
          expect(opens).toBeGreaterThanOrEqual(3);
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
            'en' as const,
            'SE' as const,
          ],
        ],
      },
    );
  });

  it('PROP: output body length grows monotonically (not strictly) with violation count', () => {
    // Sanity check: adding more violations should never SHRINK the output.
    // Generates a base set and an extended set (= base + extra) and verifies
    // body.length(extended) ≥ body.length(base).
    fc.assert(
      fc.property(
        fc.array(violationArb, { minLength: 0, maxLength: 5 }),
        fc.array(violationArb, { minLength: 1, maxLength: 5 }),
        reportMetaArb,
        (base, extra, meta) => {
          const opts = {
            locale: 'en' as const,
            jurisdiction: 'SE' as const,
            format: 'html' as const,
            authorityEmail: 'a@example.com',
            organisation: 'Org',
            feedbackUrl: 'https://example.com/fb',
          };
          const baseOut = generateStatement(base, meta, opts);
          const extendedOut = generateStatement([...base, ...extra], meta, opts);
          expect(extendedOut.body.length).toBeGreaterThanOrEqual(baseOut.body.length);
        },
      ),
      {
        numRuns: 100,
        examples: [
          [
            [],
            [
              {
                id: 'r',
                description: 'd',
                help: 'h',
                impact: 'serious' as const,
                wcag: ['1.1.1'],
                nodeCount: 1,
              },
            ],
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
  });
});

// Silence "unused" warning for optionsArb (kept for future M3.2 tests).
void optionsArb;
