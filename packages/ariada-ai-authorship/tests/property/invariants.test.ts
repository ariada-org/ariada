// SPDX-License-Identifier: EUPL-1.2
//
// Pseudo-property tests — exercises a battery of generated inputs and
// asserts the canonical invariants. Uses Math.random with a fixed-seed
// generator so the test is deterministic without pulling fast-check into
// the dependency surface of the OSS commodity outer.

import { describe, it, expect } from 'vitest';

import { attributeOffline } from '../../src/index.js';
import { ALL_AGENTS, ALL_SIGNALS } from '../../src/types.js';
import { sampleInput, sha256 } from '../helpers.js';

/** Tiny linear-congruential pseudo-random generator (seedable, deterministic). */
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x1_0000_0000;
  };
}

/** Build a random AttributionInput from a deterministic PRNG. */
function genInput(rng: () => number): ReturnType<typeof sampleInput> {
  const codeLen = 32 + Math.floor(rng() * 800);
  const chars = 'abcdefghijklmnopqrstuvwxyz_(){}[];=+- 0123456789';
  let code = '';
  for (let i = 0; i < codeLen; i += 1) {
    code += chars[Math.floor(rng() * chars.length)];
  }
  const ts = new Date(1_700_000_000_000 + Math.floor(rng() * 5_000_000_000));
  const prior = Array.from({ length: 1 + Math.floor(rng() * 9) }).map(
    () =>
      new Date(ts.getTime() - Math.floor(rng() * 86_400_000)).toISOString(),
  );
  return sampleInput({
    code,
    diff_unified: code,
    language: ['ts', 'py', 'go', 'js', 'rust'][Math.floor(rng() * 5)] ?? 'ts',
    commit_metadata: {
      timestamp_utc: ts.toISOString(),
      git_author_email: sha256(`dev-${Math.floor(rng() * 1000)}@example.com`),
      commit_message: 'feat: random',
      prior_commit_timestamps: prior,
    },
  });
}

describe('posterior invariants under random inputs', () => {
  it('holds for 100 random inputs', () => {
    const rng = lcg(0xc0ffee);
    for (let i = 0; i < 100; i += 1) {
      const input = genInput(rng);
      const result = attributeOffline(input);
      expect(result.ok).toBe(true);
      if (!result.ok) continue;
      const p = result.value;
      const sum = p.posterior.reduce((s, e) => s + e.probability, 0);
      expect(Math.abs(1 - sum)).toBeLessThan(1e-6);
      expect(p.posterior).toHaveLength(ALL_AGENTS.length);
      for (let j = 1; j < p.posterior.length; j += 1) {
        expect(p.posterior[j - 1]!.probability).toBeGreaterThanOrEqual(
          p.posterior[j]!.probability,
        );
      }
      expect(p.confidence).toBeGreaterThanOrEqual(0);
      expect(p.confidence).toBeLessThanOrEqual(0.6);
      expect(p.signal_contributions).toHaveLength(ALL_SIGNALS.length);
    }
  });

  it('is permutation-invariant for aggregated histograms', () => {
    const rng = lcg(0xdeadbeef);
    const inputs = Array.from({ length: 12 }).map(() => genInput(rng));
    const histA: Record<string, number> = {};
    const histB: Record<string, number> = {};
    for (const i of inputs) {
      const r = attributeOffline(i);
      if (!r.ok) continue;
      const top = r.value.posterior[0]!.agent;
      histA[top] = (histA[top] ?? 0) + 1;
    }
    for (const i of [...inputs].reverse()) {
      const r = attributeOffline(i);
      if (!r.ok) continue;
      const top = r.value.posterior[0]!.agent;
      histB[top] = (histB[top] ?? 0) + 1;
    }
    expect(histA).toEqual(histB);
  });

  it('is deterministic — same input yields same posterior', () => {
    const rng = lcg(0x12345);
    const input = genInput(rng);
    const a = attributeOffline(input);
    const b = attributeOffline(input);
    expect(a.ok && b.ok).toBe(true);
    if (a.ok && b.ok) {
      expect(a.value.posterior).toEqual(b.value.posterior);
      expect(a.value.confidence).toBe(b.value.confidence);
    }
  });
});
