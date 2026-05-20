// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { describe, expect, it } from 'vitest';

import {
  filterBySeverity,
  formatViolation,
  formatViolations,
} from '../../src/internal/format-violation.js';
import type { Violation } from '../../src/internal/types.js';

const baseViolation: Violation = {
  ruleId: 'color-contrast',
  impact: 'serious',
  selector: '.price-label',
  message: 'contrast 2.1:1 below 4.5:1 threshold',
  wcag: ['1.4.3'],
};

describe('formatViolation', () => {
  it('produces a single line with WCAG SC, rule id, impact, selector and message', () => {
    expect(formatViolation(baseViolation)).toBe(
      'WCAG 1.4.3 (color-contrast) [serious]: .price-label — contrast 2.1:1 below 4.5:1 threshold',
    );
  });

  it('appends additional WCAG SCs in parentheses when more than one is declared', () => {
    const v: Violation = { ...baseViolation, wcag: ['1.4.3', '1.4.11'] };
    expect(formatViolation(v)).toContain('WCAG 1.4.3 (+1.4.11)');
  });

  it('falls back to "unknown" SC when wcag list is empty', () => {
    const v: Violation = { ...baseViolation, wcag: [] };
    expect(formatViolation(v)).toContain('WCAG unknown');
  });

  it('preserves impact verbatim for each ladder rung', () => {
    for (const impact of ['minor', 'moderate', 'serious', 'critical'] as const) {
      const v: Violation = { ...baseViolation, impact };
      expect(formatViolation(v)).toContain(`[${impact}]`);
    }
  });

  it('keeps the rule id in parentheses', () => {
    const v: Violation = { ...baseViolation, ruleId: 'aria-roles' };
    expect(formatViolation(v)).toContain('(aria-roles)');
  });

  it('includes the raw selector', () => {
    const v: Violation = { ...baseViolation, selector: '#root > main > h1' };
    expect(formatViolation(v)).toContain('#root > main > h1');
  });

  it('uses em-dash separator between selector and message', () => {
    expect(formatViolation(baseViolation)).toContain(' — ');
  });
});

describe('formatViolations', () => {
  it('returns empty string for empty array', () => {
    expect(formatViolations([])).toBe('');
  });

  it('joins multiple violations with newline separators', () => {
    const second: Violation = { ...baseViolation, ruleId: 'aria-roles', selector: '#foo' };
    const out = formatViolations([baseViolation, second]);
    expect(out.split('\n')).toHaveLength(2);
  });
});

describe('filterBySeverity', () => {
  const violations: Violation[] = [
    { ...baseViolation, impact: 'minor', ruleId: 'a' },
    { ...baseViolation, impact: 'moderate', ruleId: 'b' },
    { ...baseViolation, impact: 'serious', ruleId: 'c' },
    { ...baseViolation, impact: 'critical', ruleId: 'd' },
  ];

  it('returns all violations when threshold is minor', () => {
    expect(filterBySeverity(violations, 'minor')).toHaveLength(4);
  });

  it('returns serious + critical when threshold is serious', () => {
    const out = filterBySeverity(violations, 'serious');
    expect(out.map((v) => v.ruleId)).toEqual(['c', 'd']);
  });

  it('returns critical-only when threshold is critical', () => {
    const out = filterBySeverity(violations, 'critical');
    expect(out.map((v) => v.ruleId)).toEqual(['d']);
  });
});
