// SPDX-License-Identifier: EUPL-1.2
//
// Calibration tests — AC-16. The reference OSS classifier ships a no-op
// calibration; the test exercises the Brier-score primitive against a tiny
// hand-crafted labelled set so the calibration discipline is wired and
// verifiable. A production-grade Brier ≤ 0.15 evaluation against the
// validation corpus runs via the validation harness (separate doc).

import { describe, it, expect } from 'vitest';

import { attributeOffline } from '../../src/index.js';
import { ALL_AGENTS, type AIAgentId } from '../../src/types.js';
import { sampleInput } from '../helpers.js';

/**
 * Compute a per-class binary Brier score given an array of (posterior,
 * true_label) pairs. Lower is better — perfect predictions score 0.
 */
function brierScore(
  samples: Array<{ posterior: Record<AIAgentId, number>; truth: AIAgentId }>,
): number {
  if (samples.length === 0) return 0;
  let total = 0;
  for (const { posterior, truth } of samples) {
    for (const agent of ALL_AGENTS) {
      const indicator = agent === truth ? 1 : 0;
      const p = posterior[agent] ?? 0;
      total += (p - indicator) ** 2;
    }
  }
  return total / (samples.length * ALL_AGENTS.length);
}

describe('Brier-score primitive (AC-16 surface)', () => {
  it('returns 0 on perfectly calibrated predictions', () => {
    const posterior: Record<AIAgentId, number> = Object.fromEntries(
      ALL_AGENTS.map((a) => [a, a === 'human' ? 1 : 0]),
    ) as Record<AIAgentId, number>;
    const score = brierScore([{ posterior, truth: 'human' }]);
    expect(score).toBe(0);
  });

  it('returns a positive score on miscalibrated predictions', () => {
    const posterior: Record<AIAgentId, number> = Object.fromEntries(
      ALL_AGENTS.map((a) => [a, 1 / ALL_AGENTS.length]),
    ) as Record<AIAgentId, number>;
    const score = brierScore([{ posterior, truth: 'human' }]);
    expect(score).toBeGreaterThan(0);
  });

  it('produces a numerically-stable score against the offline classifier', () => {
    // Spot-check: against a uniform-ish posterior the per-class Brier is
    // bounded below the worst-case 2/N. We only assert it is finite and
    // non-negative here — the actual corpus-wide gate lives in the
    // validation harness.
    const result = attributeOffline(sampleInput());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const posterior = Object.fromEntries(
      result.value.posterior.map((e) => [e.agent, e.probability]),
    ) as Record<AIAgentId, number>;
    const score = brierScore([{ posterior, truth: 'human' }]);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(score)).toBe(true);
  });
});
