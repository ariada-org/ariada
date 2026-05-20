// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { describe, expect, it } from 'vitest';

import { computeScore, countBySeverity, scoreBucket, statusBarText } from '../../src/score.js';

describe('score — countBySeverity', () => {
  it('counts each bucket', () => {
    const counts = countBySeverity(['critical', 'critical', 'serious', 'moderate', 'minor']);
    expect(counts).toEqual({ critical: 2, serious: 1, moderate: 1, minor: 1 });
  });

  it('returns zeros for an empty list', () => {
    expect(countBySeverity([])).toEqual({ critical: 0, serious: 0, moderate: 0, minor: 0 });
  });
});

describe('score — computeScore', () => {
  it('100 with zero findings', () => {
    expect(computeScore({ critical: 0, serious: 0, moderate: 0, minor: 0 })).toBe(100);
  });

  it('subtracts 10 per critical, 3 per serious, 1 per moderate', () => {
    expect(computeScore({ critical: 1, serious: 1, moderate: 1, minor: 5 })).toBe(86);
  });

  it('clamps to 0', () => {
    expect(computeScore({ critical: 20, serious: 0, moderate: 0, minor: 0 })).toBe(0);
  });

  it('three critical → 70', () => {
    expect(computeScore({ critical: 3, serious: 0, moderate: 0, minor: 0 })).toBe(70);
  });
});

describe('score — scoreBucket', () => {
  it.each([
    [100, 'good'],
    [90, 'good'],
    [89, 'warn'],
    [70, 'warn'],
    [69, 'bad'],
    [0, 'bad'],
  ])('score %i maps to bucket %s', (s, bucket) => {
    expect(scoreBucket(s)).toBe(bucket);
  });
});

describe('score — statusBarText', () => {
  it('renders the good glyph when score >= 90', () => {
    expect(statusBarText(100, 0)).toBe('✓ ariada 100 · 0 issues');
  });

  it('renders the warn glyph between 70 and 89', () => {
    expect(statusBarText(78, 3)).toBe('⚠ ariada 78 · 3 issues');
  });

  it('renders the bad glyph below 70', () => {
    expect(statusBarText(54, 7)).toBe('✗ ariada 54 · 7 issues');
  });

  it('uses singular noun for one finding', () => {
    expect(statusBarText(90, 1)).toBe('✓ ariada 90 · 1 issue');
  });
});
