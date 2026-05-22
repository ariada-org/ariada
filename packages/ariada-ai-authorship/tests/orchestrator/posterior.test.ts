// SPDX-License-Identifier: EUPL-1.2
import { describe, it, expect } from 'vitest';

import { attributeOffline } from '../../src/index.js';
import {
  applyCalibration,
  combineLogits,
} from '../../src/orchestrator/index.js';
import {
  buildPosterior,
  computeConfidence,
  softmax,
} from '../../src/orchestrator/posterior.js';
import { extractLexicalEntropy } from '../../src/signals/lexical-entropy.js';
import { ALL_AGENTS } from '../../src/types.js';
import { sampleInput } from '../helpers.js';

describe('posterior projection', () => {
  it('softmax distribution sums to 1', () => {
    const logits = Object.fromEntries(ALL_AGENTS.map((a, i) => [a, i * 0.1]));
    const probs = softmax(logits as unknown as Record<string, number> as never);
    const sum = ALL_AGENTS.reduce((s, a) => s + probs[a], 0);
    expect(sum).toBeCloseTo(1, 6);
  });

  it('buildPosterior emits 10 entries — all agents present (all-agents-present invariant)', () => {
    const logits = Object.fromEntries(ALL_AGENTS.map((a) => [a, 0]));
    const probs = softmax(logits as unknown as Record<string, number> as never);
    const posterior = buildPosterior(probs);
    expect(posterior).toHaveLength(ALL_AGENTS.length);
  });

  it('buildPosterior emits sorted-descending order (probability-descending order rule)', () => {
    const probs = Object.fromEntries(
      ALL_AGENTS.map((a, i) => [a, (i + 1) / 55]),
    );
    const posterior = buildPosterior(probs as unknown as Record<string, number> as never);
    for (let i = 1; i < posterior.length; i += 1) {
      const prev = posterior[i - 1]!;
      const curr = posterior[i]!;
      expect(prev.probability).toBeGreaterThanOrEqual(curr.probability);
    }
  });

  it('computeConfidence returns a value in [0, 1]', () => {
    const probs = Object.fromEntries(
      ALL_AGENTS.map((a) => [a, 1 / ALL_AGENTS.length]),
    );
    const c = computeConfidence(probs as unknown as Record<string, number> as never);
    expect(c).toBeGreaterThanOrEqual(0);
    expect(c).toBeLessThanOrEqual(1);
  });

  it('end-to-end offline classify satisfies every invariant', () => {
    const result = attributeOffline(sampleInput());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const p = result.value;
    // sum-to-one invariant
    const sum = p.posterior.reduce((s, e) => s + e.probability, 0);
    expect(Math.abs(1 - sum)).toBeLessThan(1e-6);
    // all-agents-present invariant
    expect(p.posterior).toHaveLength(ALL_AGENTS.length);
    const seen = new Set(p.posterior.map((e) => e.agent));
    for (const agent of ALL_AGENTS) expect(seen.has(agent)).toBe(true);
    // probability-descending order rule
    for (let i = 1; i < p.posterior.length; i += 1) {
      expect(p.posterior[i - 1]!.probability).toBeGreaterThanOrEqual(
        p.posterior[i]!.probability,
      );
    }
    // confidence-bounded invariant
    expect(p.confidence).toBeGreaterThanOrEqual(0);
    expect(p.confidence).toBeLessThanOrEqual(1);
    // offline-mode confidence cap
    expect(p.inference_mode).toBe('offline');
    expect(p.confidence).toBeLessThanOrEqual(0.6);
    // four-signals invariant
    expect(p.signal_contributions).toHaveLength(4);
    // per-signal contribution-sum invariant
    for (const sig of p.signal_contributions) {
      const ssum = ALL_AGENTS.reduce(
        (s, a) => s + sig.contributions_per_agent[a],
        0,
      );
      expect(Math.abs(ssum)).toBeLessThan(1e-9);
    }
    // version-pins-present invariant
    expect(p.classifier_version.length).toBeGreaterThan(0);
    expect(p.calibration_version.length).toBeGreaterThan(0);
    expect(/^\d+\.\d+\.\d+/u.test(p.classifier_version)).toBe(true);
    expect(/^\d+\.\d+\.\d+/u.test(p.calibration_version)).toBe(true);
  });

  it('combineLogits + applyCalibration produces a finite vector', () => {
    const contributions = [extractLexicalEntropy(sampleInput())];
    const logits = combineLogits(contributions);
    const calibrated = applyCalibration(logits);
    for (const agent of ALL_AGENTS) {
      expect(Number.isFinite(calibrated[agent])).toBe(true);
    }
  });
});
