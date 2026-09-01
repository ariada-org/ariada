import { describe, expect, it } from 'vitest';

import { mapAxeImpact } from '../src/axe-severity.js';

describe('mapAxeImpact', () => {
  it('maps each canonical axe impact directly', () => {
    expect(mapAxeImpact('critical')).toBe('critical');
    expect(mapAxeImpact('serious')).toBe('serious');
    expect(mapAxeImpact('moderate')).toBe('moderate');
    expect(mapAxeImpact('minor')).toBe('minor');
  });

  it('falls back to moderate for null / undefined / unknown', () => {
    expect(mapAxeImpact(null)).toBe('moderate');
    expect(mapAxeImpact(undefined)).toBe('moderate');
    expect(mapAxeImpact('catastrophic')).toBe('moderate');
  });
});
