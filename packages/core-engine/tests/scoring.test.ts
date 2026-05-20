// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { describe, expect, it } from 'vitest';

import { bandFromScore, scoreFromCounts } from '../src/scoring.js';

describe('scoreFromCounts', () => {
  it('returns 100 for zero violations', () => {
    expect(scoreFromCounts({ critical: 0, serious: 0, moderate: 0, minor: 0 })).toBe(100);
  });

  it('subtracts 10 per critical', () => {
    expect(scoreFromCounts({ critical: 1, serious: 0, moderate: 0, minor: 0 })).toBe(90);
  });

  it('subtracts 5 per serious', () => {
    expect(scoreFromCounts({ critical: 0, serious: 1, moderate: 0, minor: 0 })).toBe(95);
  });

  it('subtracts 2 per moderate', () => {
    expect(scoreFromCounts({ critical: 0, serious: 0, moderate: 1, minor: 0 })).toBe(98);
  });

  it('subtracts 1 per minor', () => {
    expect(scoreFromCounts({ critical: 0, serious: 0, moderate: 0, minor: 1 })).toBe(99);
  });

  it('floors at 0 (overflow)', () => {
    expect(scoreFromCounts({ critical: 100, serious: 100, moderate: 100, minor: 100 })).toBe(0);
  });

  it('combines all weights', () => {
    expect(scoreFromCounts({ critical: 1, serious: 1, moderate: 1, minor: 1 })).toBe(100 - 18);
  });
});

describe('bandFromScore boundaries', () => {
  it('0 → critical', () => expect(bandFromScore(0)).toBe('critical'));
  it('29 → critical, 30 → poor', () => {
    expect(bandFromScore(29)).toBe('critical');
    expect(bandFromScore(30)).toBe('poor');
  });
  it('49 → poor, 50 → fair', () => {
    expect(bandFromScore(49)).toBe('poor');
    expect(bandFromScore(50)).toBe('fair');
  });
  it('69 → fair, 70 → good', () => {
    expect(bandFromScore(69)).toBe('fair');
    expect(bandFromScore(70)).toBe('good');
  });
  it('89 → good, 90 → excellent', () => {
    expect(bandFromScore(89)).toBe('good');
    expect(bandFromScore(90)).toBe('excellent');
  });
  it('100 → excellent', () => expect(bandFromScore(100)).toBe('excellent'));
});
