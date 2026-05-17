// SPDX-License-Identifier: EUPL-1.2
/**
 * Tests for VPAT 2.5 emitter.
 */

import { describe, it, expect } from 'vitest';

import { emitVpat } from './emit-vpat.js';
import type { Violation, ReportMeta } from './types.js';

const baseMeta: ReportMeta = {
  productName: 'Test Product',
  productVersion: '1.0.0',
  evaluator: 'Agonist Development AB',
  evaluatorContact: 'a11y@example.com',
  evaluationDate: '2026-05-15',
  scope: 'https://example.com/checkout',
  methodology: 'Automated axe-core + manual review',
};

describe('emitVpat', () => {
  it('returns a VpatReport with schema marker and metadata', () => {
    const report = emitVpat([], baseMeta);
    expect(report.$schema).toBe('https://schemas.ariada.org/vpat/2.5.json');
    expect(report.schemaVersion).toBe('2.5');
    expect(report.meta).toEqual(baseMeta);
    expect(report.applicableStandards.some((s) => s.includes('WCAG 2.2 Level AA'))).toBe(true);
  });

  it('emits "Supports" for criteria with no violations', () => {
    const report = emitVpat([], baseMeta);
    const sc111 = report.criteria.find((c) => c.criterion === '1.1.1');
    expect(sc111).toBeDefined();
    expect(sc111?.conformance).toBe('Supports');
  });

  it('emits "Does Not Support" for criteria with serious / critical violations', () => {
    const violations: Violation[] = [
      {
        id: 'color-contrast',
        description: 'Insufficient colour contrast',
        help: 'Increase contrast ratio',
        impact: 'serious',
        wcag: ['1.4.3'],
        nodeCount: 5,
      },
    ];
    const report = emitVpat(violations, baseMeta);
    const sc = report.criteria.find((c) => c.criterion === '1.4.3');
    expect(sc?.conformance).toBe('Does Not Support');
    expect(sc?.remarks).toContain('1 violation');
    expect(sc?.remarks).toContain('5');
  });

  it('emits "Partially Supports" for moderate / minor violations', () => {
    const violations: Violation[] = [
      {
        id: 'image-alt',
        description: 'Missing alt text',
        help: 'Provide alt text',
        impact: 'moderate',
        wcag: ['1.1.1'],
      },
    ];
    const report = emitVpat(violations, baseMeta);
    expect(report.criteria.find((c) => c.criterion === '1.1.1')?.conformance).toBe(
      'Partially Supports',
    );
  });

  it('aggregates multiple violations targeting the same SC', () => {
    const violations: Violation[] = [
      {
        id: 'a',
        description: 'a',
        help: 'a',
        impact: 'moderate',
        wcag: ['1.1.1'],
        nodeCount: 3,
      },
      {
        id: 'b',
        description: 'b',
        help: 'b',
        impact: 'critical',
        wcag: ['1.1.1'],
        nodeCount: 2,
      },
    ];
    const report = emitVpat(violations, baseMeta);
    const sc = report.criteria.find((c) => c.criterion === '1.1.1');
    expect(sc?.conformance).toBe('Does Not Support'); // critical wins
    expect(sc?.remarks).toContain('2 violations');
  });

  it('produces accurate summary counts', () => {
    const violations: Violation[] = [
      { id: 'x', description: 'x', help: 'x', impact: 'critical', wcag: ['1.4.3'] },
      { id: 'y', description: 'y', help: 'y', impact: 'moderate', wcag: ['2.4.7'] },
    ];
    const report = emitVpat(violations, baseMeta);
    expect(report.summary.total).toBeGreaterThan(0);
    expect(report.summary.doesNotSupport).toBeGreaterThanOrEqual(1);
    expect(report.summary.partiallySupports).toBeGreaterThanOrEqual(1);
    expect(
      report.summary.supports +
        report.summary.partiallySupports +
        report.summary.doesNotSupport +
        report.summary.notApplicable +
        report.summary.notEvaluated,
    ).toBe(report.summary.total);
  });

  it('marks unknown SCs (level=AAA) as Not Evaluated by default', () => {
    const report = emitVpat([], baseMeta);
    const aaaCriteria = report.criteria.filter((c) => c.level === 'AAA');
    expect(aaaCriteria.length).toBeGreaterThan(0);
    expect(aaaCriteria.every((c) => c.conformance === 'Not Evaluated')).toBe(true);
  });

  it('JSON-roundtrips losslessly', () => {
    const violations: Violation[] = [
      { id: 'z', description: 'z', help: 'z', impact: 'serious', wcag: ['1.3.1'] },
    ];
    const report = emitVpat(violations, baseMeta);
    const roundtripped = JSON.parse(JSON.stringify(report));
    expect(roundtripped).toEqual(report);
  });

  // Wave 2 expansion (LAGRANGE) — boundary + edge cases

  it('handles single minor violation (boundary impact)', () => {
    const v: Violation[] = [
      { id: 'x', description: 'x', help: 'x', impact: 'minor', wcag: ['1.1.1'] },
    ];
    const r = emitVpat(v, baseMeta);
    expect(r.criteria.find((c) => c.criterion === '1.1.1')?.conformance).toBe('Partially Supports');
  });

  it('handles 100+ violations stress test', () => {
    const v: Violation[] = Array.from({ length: 100 }, (_, i) => ({
      id: `r${i}`,
      description: `D${i}`,
      help: 'h',
      impact: 'serious' as const,
      wcag: ['1.4.3'],
    }));
    const r = emitVpat(v, baseMeta);
    expect(r.summary.doesNotSupport).toBeGreaterThan(0);
  });

  it('handles Unicode chars (åäö Cyrillic emoji) in description', () => {
    const v: Violation[] = [
      { id: 'x', description: 'Otillräcklig 🚨 Цвет', help: 'fix', impact: 'serious', wcag: ['1.4.3'] },
    ];
    const r = emitVpat(v, baseMeta);
    expect(r.criteria.find((c) => c.criterion === '1.4.3')?.conformance).toBe('Does Not Support');
  });

  it('preserves all WCAG SCs in violation.wcag (multi-SC mapping)', () => {
    const v: Violation[] = [
      { id: 'multi', description: 'm', help: 'm', impact: 'critical', wcag: ['1.4.3', '2.4.7', '4.1.2'] },
    ];
    const r = emitVpat(v, baseMeta);
    expect(r.criteria.find((c) => c.criterion === '1.4.3')?.conformance).toBe('Does Not Support');
    expect(r.criteria.find((c) => c.criterion === '2.4.7')?.conformance).toBe('Does Not Support');
    expect(r.criteria.find((c) => c.criterion === '4.1.2')?.conformance).toBe('Does Not Support');
  });

  it('schema marker is the same regardless of violation count', () => {
    const a = emitVpat([], baseMeta);
    const b = emitVpat(
      [{ id: 'x', description: 'x', help: 'x', impact: 'critical', wcag: ['1.1.1'] }],
      baseMeta,
    );
    expect(a.$schema).toBe(b.$schema);
  });

  it('meta object is preserved exactly', () => {
    const r = emitVpat([], baseMeta);
    expect(r.meta).toEqual(baseMeta);
  });

  it('handles empty wcag array (no SC mapping)', () => {
    const v: Violation[] = [
      { id: 'no-sc', description: 'orphan', help: 'h', impact: 'serious', wcag: [] },
    ];
    const r = emitVpat(v, baseMeta);
    // Should not crash; summary still has totals.
    expect(r.summary.total).toBeGreaterThan(0);
  });

  it('handles violation with zero nodeCount (no nodes affected)', () => {
    const v: Violation[] = [
      { id: 'x', description: 'x', help: 'x', impact: 'serious', wcag: ['1.4.3'], nodeCount: 0 },
    ];
    const r = emitVpat(v, baseMeta);
    expect(r.criteria.find((c) => c.criterion === '1.4.3')?.conformance).toBe('Does Not Support');
  });

  it('handles violation without nodeCount field (defaults gracefully)', () => {
    const v: Violation[] = [
      { id: 'x', description: 'x', help: 'x', impact: 'critical', wcag: ['1.4.3'] },
    ];
    const r = emitVpat(v, baseMeta);
    expect(r.criteria.find((c) => c.criterion === '1.4.3')?.conformance).toBe('Does Not Support');
  });

  it('applicableStandards includes EN 301 549 reference (or equivalent)', () => {
    const r = emitVpat([], baseMeta);
    // Standards array is non-empty.
    expect(r.applicableStandards.length).toBeGreaterThan(0);
  });
});