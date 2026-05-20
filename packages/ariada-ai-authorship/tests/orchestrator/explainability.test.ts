// SPDX-License-Identifier: EUPL-1.2
//
// Explainability tests — AC-2: signal_contributions[] is present, length 4,
// and at least one agent receives a non-zero contribution per signal.

import { describe, it, expect } from 'vitest';

import { attributeOffline, extractSignals } from '../../src/index.js';
import { ALL_SIGNALS, ALL_AGENTS } from '../../src/types.js';
import { sampleInput } from '../helpers.js';

describe('explainability surface (AC-2)', () => {
  it('emits exactly four signal contributions in canonical order', () => {
    const result = attributeOffline(sampleInput());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const names = result.value.signal_contributions.map((s) => s.signal_name);
    expect(names).toEqual([...ALL_SIGNALS]);
  });

  it('per-signal contributions are non-zero on at least 1 agent each', () => {
    const result = attributeOffline(sampleInput());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    for (const sig of result.value.signal_contributions) {
      const nonZero = ALL_AGENTS.some(
        (a) => Math.abs(sig.contributions_per_agent[a]) > 1e-9,
      );
      expect(nonZero).toBe(true);
    }
  });

  it('extractSignals returns the same shape as the posterior surface', () => {
    const signals = extractSignals(sampleInput());
    expect(signals.ok).toBe(true);
    if (!signals.ok) return;
    expect(signals.value.map((s) => s.signal_name)).toEqual([...ALL_SIGNALS]);
  });
});
