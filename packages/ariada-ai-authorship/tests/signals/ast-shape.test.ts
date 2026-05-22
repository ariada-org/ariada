// SPDX-License-Identifier: EUPL-1.2
import { describe, it, expect } from 'vitest';

import { bracketShape, extractAstShape } from '../../src/signals/ast-shape.js';
import { ALL_AGENTS } from '../../src/types.js';
import { sampleInput } from '../helpers.js';

describe('AST shape signal', () => {
  it('reports zero depth on a flat string', () => {
    expect(bracketShape('hello world')).toEqual({ max_depth: 0, branches: 0 });
  });

  it('reports nested depth on bracket-heavy code', () => {
    const { max_depth, branches } = bracketShape('{{{}}}({})');
    expect(max_depth).toBeGreaterThanOrEqual(3);
    expect(branches).toBeGreaterThan(0);
  });

  it('produces zero-sum contributions (per-signal contribution-sum invariant)', () => {
    const contrib = extractAstShape(sampleInput());
    const sum = ALL_AGENTS.reduce(
      (s, a) => s + contrib.contributions_per_agent[a],
      0,
    );
    expect(Math.abs(sum)).toBeLessThan(1e-9);
  });

  it('returns extraction_confidence ~0 on tiny inputs', () => {
    const contrib = extractAstShape(sampleInput({ code: 'x' }));
    expect(contrib.extraction_confidence).toBeLessThan(0.05);
  });
});
