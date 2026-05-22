// SPDX-License-Identifier: EUPL-1.2
import { describe, it, expect } from 'vitest';

import {
  extractLexicalEntropy,
  shannonEntropy,
  tokenise,
} from '../../src/signals/lexical-entropy.js';
import { ALL_AGENTS } from '../../src/types.js';
import { sampleInput } from '../helpers.js';

describe('lexical entropy signal', () => {
  it('tokenises a mixed-case identifier blob', () => {
    expect(tokenise('alpha bravo_charlie 123 delta')).toEqual([
      'alpha',
      'bravo_charlie',
      '123',
      'delta',
    ]);
  });

  it('returns 0 entropy on empty input', () => {
    expect(shannonEntropy([])).toBe(0);
  });

  it('returns 0 entropy on a single token', () => {
    expect(shannonEntropy(['x'])).toBe(0);
  });

  it('computes positive entropy on varied tokens', () => {
    expect(shannonEntropy(['a', 'b', 'c'])).toBeGreaterThan(0);
  });

  it('returns extraction_confidence 0 on empty hunk', () => {
    const input = sampleInput({ code: '' });
    const contrib = extractLexicalEntropy(input);
    expect(contrib.extraction_confidence).toBe(0);
    // Zero-confidence contributions are zero-sum and (essentially) zero.
    for (const agent of ALL_AGENTS) {
      expect(Math.abs(contrib.contributions_per_agent[agent])).toBeLessThan(1e-9);
    }
  });

  it('returns per-signal zero-sum contributions (per-signal contribution-sum invariant)', () => {
    const input = sampleInput();
    const contrib = extractLexicalEntropy(input);
    const sum = ALL_AGENTS.reduce(
      (s, a) => s + contrib.contributions_per_agent[a],
      0,
    );
    expect(Math.abs(sum)).toBeLessThan(1e-9);
  });
});
