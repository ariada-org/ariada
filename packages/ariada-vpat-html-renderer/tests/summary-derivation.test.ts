// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { describe, expect, it } from 'vitest';

import { formatNarrative } from '../src/sections/summary.js';
import type { VpatSummary } from '../src/types.js';

describe('formatNarrative', () => {
  const summary: VpatSummary = {
    total: 87,
    supports: 55,
    partiallySupports: 0,
    doesNotSupport: 1,
    notApplicable: 0,
    notEvaluated: 31,
  };

  it('substitutes every placeholder', () => {
    const template =
      'Of {total} WCAG: {supports} supports, {partial} partial, {doesNot} fail, {notApplicable} N/A, {notEvaluated} ne.';
    expect(formatNarrative(summary, template)).toBe(
      'Of 87 WCAG: 55 supports, 0 partial, 1 fail, 0 N/A, 31 ne.',
    );
  });

  it('leaves text without placeholders unchanged', () => {
    expect(formatNarrative(summary, 'plain text')).toBe('plain text');
  });

  it('handles zero values', () => {
    const empty: VpatSummary = {
      total: 0,
      supports: 0,
      partiallySupports: 0,
      doesNotSupport: 0,
      notApplicable: 0,
      notEvaluated: 0,
    };
    expect(formatNarrative(empty, '{total}/{supports}')).toBe('0/0');
  });
});
