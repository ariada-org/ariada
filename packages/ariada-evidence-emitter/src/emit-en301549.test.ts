// SPDX-License-Identifier: EUPL-1.2
/**
 * Tests for EN 301 549 v3.2.1 §11 emitter.
 */

import { describe, it, expect } from 'vitest';

import { emitEn301549 } from './emit-en301549.js';
import type { Violation, ReportMeta } from './types.js';

const baseMeta: ReportMeta = {
  productName: 'Test Product',
  evaluator: 'Agonist Development AB',
  evaluationDate: '2026-05-15',
  scope: 'https://example.com',
};

describe('emitEn301549', () => {
  it('emits schema marker and version', () => {
    const r = emitEn301549([], baseMeta);
    expect(r.$schema).toBe('https://schemas.ariada.org/en301549/3.2.1.json');
    expect(r.schemaVersion).toBe('3.2.1');
  });

  it('clauses default to "conformant" with zero violations', () => {
    const r = emitEn301549([], baseMeta);
    const c1111 = r.clauses.find((c) => c.clause === '11.1.1.1');
    expect(c1111?.status).toBe('conformant');
    expect(c1111?.issueCount).toBe(0);
  });

  it('marks clause non-conformant on direct en301549 mapping', () => {
    const v: Violation[] = [
      {
        id: 'foo',
        description: 'bar',
        help: 'baz',
        impact: 'serious',
        wcag: ['1.1.1'],
        en301549: ['11.1.1.1'],
        nodeCount: 4,
      },
    ];
    const r = emitEn301549(v, baseMeta);
    const c = r.clauses.find((cl) => cl.clause === '11.1.1.1');
    expect(c?.status).toBe('non-conformant');
    expect(c?.issueCount).toBe(1);
  });

  it('maps WCAG SC → §11.x.y.z clause when no explicit en301549 given', () => {
    // EN 301 549 §11.x.y.z mirrors WCAG x.y.z 1:1 for SC < 11.0
    const v: Violation[] = [
      {
        id: 'color',
        description: 'low contrast',
        help: 'fix it',
        impact: 'serious',
        wcag: ['1.4.3'],
      },
    ];
    const r = emitEn301549(v, baseMeta);
    const c = r.clauses.find((cl) => cl.clause === '11.1.4.3');
    expect(c).toBeDefined();
    expect(c?.status).toBe('non-conformant');
  });

  it('moderate violations → partially-conformant', () => {
    const v: Violation[] = [
      {
        id: 'q',
        description: 'q',
        help: 'q',
        impact: 'moderate',
        wcag: ['2.4.7'],
      },
    ];
    const r = emitEn301549(v, baseMeta);
    const c = r.clauses.find((cl) => cl.clause === '11.2.4.7');
    expect(c?.status).toBe('partially-conformant');
  });

  it('appends extra §11 clauses that do not mirror any WCAG SC', () => {
    // EN 301 549 §11.7 (user preferences) has no WCAG mirror — must be appended
    const v: Violation[] = [
      {
        id: 'pref',
        description: 'no user-preference inheritance',
        help: 'inherit from OS',
        impact: 'moderate',
        wcag: [],
        en301549: ['11.7'],
        nodeCount: 2,
      },
    ];
    const r = emitEn301549(v, baseMeta);
    const extra = r.clauses.find((c) => c.clause === '11.7');
    expect(extra).toBeDefined();
    expect(extra?.status).toBe('partially-conformant');
    expect(extra?.issueCount).toBe(1);
    expect(extra?.remarks).toContain('Direct §11 clause');
  });

  it('ignores malformed WCAG SCs (non-x.y.z form)', () => {
    const v: Violation[] = [
      {
        id: 'q',
        description: 'q',
        help: 'q',
        impact: 'serious',
        // first SC is malformed, second valid; only second produces a clause mapping
        wcag: ['invalid', '1.4.3'],
      },
    ];
    const r = emitEn301549(v, baseMeta);
    expect(r.clauses.find((c) => c.clause === '11.1.4.3')?.status).toBe('non-conformant');
  });

  it('aggregates multiple violations on the same §11 clause (maxImpact wins)', () => {
    const v: Violation[] = [
      { id: 'a', description: 'a', help: 'a', impact: 'moderate', wcag: ['1.4.3'], nodeCount: 2 },
      { id: 'b', description: 'b', help: 'b', impact: 'critical', wcag: ['1.4.3'], nodeCount: 3 },
    ];
    const r = emitEn301549(v, baseMeta);
    const c = r.clauses.find((cl) => cl.clause === '11.1.4.3');
    expect(c?.issueCount).toBe(2);
    expect(c?.status).toBe('non-conformant'); // critical wins
    expect(c?.remarks).toContain('5'); // 2+3 total nodes
  });

  it('summary counts match clause-array distribution', () => {
    const v: Violation[] = [
      { id: 'a', description: 'a', help: 'a', impact: 'serious', wcag: ['1.4.3'] },
    ];
    const r = emitEn301549(v, baseMeta);
    const counted =
      r.summary.conformant +
      r.summary.partiallyConformant +
      r.summary.nonConformant +
      r.summary.notApplicable +
      r.summary.notEvaluated;
    expect(counted).toBe(r.summary.total);
    expect(r.summary.nonConformant).toBeGreaterThanOrEqual(1);
  });

  // Wave 2 expansion (LAGRANGE) — boundary + edge cases

  it('handles 100+ violations stress test', () => {
    const v: Violation[] = Array.from({ length: 100 }, (_, i) => ({
      id: `r${i}`,
      description: `D${i}`,
      help: 'h',
      impact: 'serious' as const,
      wcag: ['1.4.3'],
    }));
    const r = emitEn301549(v, baseMeta);
    expect(r.clauses.find((c) => c.clause === '11.1.4.3')?.issueCount).toBe(100);
  });

  it('handles Unicode chars (åäö Cyrillic emoji) in description', () => {
    const v: Violation[] = [
      {
        id: 'unicode',
        description: 'Otillräcklig 🚨 контраст',
        help: 'fix',
        impact: 'serious',
        wcag: ['1.4.3'],
      },
    ];
    const r = emitEn301549(v, baseMeta);
    expect(r.clauses.find((c) => c.clause === '11.1.4.3')?.status).toBe('non-conformant');
  });

  it('handles violation with §11.8 (Authoring Tools) clause appended', () => {
    const v: Violation[] = [
      {
        id: 'auth',
        description: 'authoring tool issue',
        help: 'h',
        impact: 'moderate',
        wcag: [],
        en301549: ['11.8'],
      },
    ];
    const r = emitEn301549(v, baseMeta);
    expect(r.clauses.find((c) => c.clause === '11.8')?.status).toBe('partially-conformant');
  });

  it('handles violation with multiple en301549 clauses', () => {
    const v: Violation[] = [
      {
        id: 'multi',
        description: 'm',
        help: 'h',
        impact: 'critical',
        wcag: [],
        en301549: ['11.1.1.1', '11.1.4.3', '11.2.4.7'],
      },
    ];
    const r = emitEn301549(v, baseMeta);
    expect(r.clauses.find((c) => c.clause === '11.1.1.1')?.status).toBe('non-conformant');
    expect(r.clauses.find((c) => c.clause === '11.1.4.3')?.status).toBe('non-conformant');
    expect(r.clauses.find((c) => c.clause === '11.2.4.7')?.status).toBe('non-conformant');
  });

  it('JSON-roundtrips losslessly with mixed violations', () => {
    const v: Violation[] = [
      { id: 'a', description: 'a', help: 'a', impact: 'serious', wcag: ['1.4.3'] },
      { id: 'b', description: 'b', help: 'b', impact: 'moderate', wcag: ['2.4.7'] },
    ];
    const r = emitEn301549(v, baseMeta);
    expect(JSON.parse(JSON.stringify(r))).toEqual(r);
  });

  it('handles minor violations → partially-conformant clause status', () => {
    const v: Violation[] = [
      { id: 'x', description: 'x', help: 'x', impact: 'minor', wcag: ['1.4.4'] },
    ];
    const r = emitEn301549(v, baseMeta);
    expect(r.clauses.find((c) => c.clause === '11.1.4.4')?.status).toBe('partially-conformant');
  });

  it('handles empty violations list → all clauses conformant', () => {
    const r = emitEn301549([], baseMeta);
    expect(r.summary.nonConformant).toBe(0);
    expect(r.summary.partiallyConformant).toBe(0);
    expect(r.summary.conformant + r.summary.notEvaluated + r.summary.notApplicable).toBe(
      r.summary.total,
    );
  });

  it('preserves meta exactly in report', () => {
    const r = emitEn301549([], baseMeta);
    expect(r.meta).toEqual(baseMeta);
  });

  it('schema marker stable across populations', () => {
    const empty = emitEn301549([], baseMeta);
    const populated = emitEn301549(
      [{ id: 'x', description: 'x', help: 'x', impact: 'serious', wcag: ['1.4.3'] }],
      baseMeta,
    );
    expect(empty.$schema).toBe(populated.$schema);
  });

  it('summary fields are all non-negative integers', () => {
    const r = emitEn301549([], baseMeta);
    expect(r.summary.conformant).toBeGreaterThanOrEqual(0);
    expect(r.summary.partiallyConformant).toBeGreaterThanOrEqual(0);
    expect(r.summary.nonConformant).toBeGreaterThanOrEqual(0);
    expect(r.summary.total).toBeGreaterThanOrEqual(r.summary.conformant);
  });

  it('handles 5+ unique WCAG SCs mapped to 5+ different §11 clauses', () => {
    const scs = ['1.1.1', '1.4.3', '2.4.7', '3.3.1', '4.1.2'];
    const v: Violation[] = scs.map((sc) => ({
      id: `r-${sc}`,
      description: `desc-${sc}`,
      help: 'h',
      impact: 'serious' as const,
      wcag: [sc],
    }));
    const r = emitEn301549(v, baseMeta);
    for (const sc of scs) {
      expect(r.clauses.find((c) => c.clause === `11.${sc}`)?.status).toBe('non-conformant');
    }
  });
});