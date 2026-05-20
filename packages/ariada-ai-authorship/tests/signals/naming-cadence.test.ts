// SPDX-License-Identifier: EUPL-1.2
import { describe, it, expect } from 'vitest';

import {
  extractNamingCadence,
  identifierStyle,
  styleEntropy,
} from '../../src/signals/naming-cadence.js';
import { ALL_AGENTS } from '../../src/types.js';
import { sampleInput } from '../helpers.js';

describe('naming cadence signal', () => {
  it('classifies known identifier styles', () => {
    expect(identifierStyle('camelCase')).toBe('camelCase');
    expect(identifierStyle('snake_case')).toBe('snake_case');
    expect(identifierStyle('PascalCase')).toBe('PascalCase');
    expect(identifierStyle('SCREAMING_SNAKE')).toBe('SCREAMING');
    expect(identifierStyle('lowercase')).toBe('lowercase');
  });

  it('returns 0 entropy on a single style', () => {
    expect(styleEntropy(['foo', 'bar', 'baz'])).toBe(0);
  });

  it('returns positive entropy on mixed styles', () => {
    expect(styleEntropy(['fooBar', 'snake_case', 'PascalCase'])).toBeGreaterThan(
      0,
    );
  });

  it('produces zero-sum contributions invariant §3.3-7', () => {
    const contrib = extractNamingCadence(sampleInput());
    const sum = ALL_AGENTS.reduce(
      (s, a) => s + contrib.contributions_per_agent[a],
      0,
    );
    expect(Math.abs(sum)).toBeLessThan(1e-9);
  });
});
