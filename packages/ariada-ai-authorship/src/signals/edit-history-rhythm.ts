// SPDX-License-Identifier: EUPL-1.2
//
// Edit-history-rhythm signal — captures commit-timing patterns. AI-tool-
// assisted output tends to bursts of short-interval commits punctuated by
// silence; human commits alternate with breaks more evenly. The signal
// extracts the mean + variance of inter-commit gaps over the recent window
// and projects them onto agent-specific log-odds nudges.

import type {
  AIAgentId,
  AttributionInput,
  SignalContribution,
} from '../types.js';

import { scaleZeroSum } from './lexical-entropy.js';

/**
 * Compute the inter-commit gap statistics over the `prior_commit_timestamps`
 * array plus the current commit timestamp. Returns gaps in seconds, sorted
 * ascending, plus mean + variance + count.
 */
export function commitGapStats(
  current: string,
  prior: string[],
): { mean_seconds: number; variance_seconds: number; n: number } {
  const all = [...prior, current]
    .map((t) => Date.parse(t))
    .filter((ms) => Number.isFinite(ms))
    .sort((a, b) => a - b);
  if (all.length < 2) {
    return { mean_seconds: 0, variance_seconds: 0, n: all.length };
  }
  const gaps: number[] = [];
  for (let i = 1; i < all.length; i += 1) {
    const prev = all[i - 1];
    const curr = all[i];
    if (prev === undefined || curr === undefined) continue;
    gaps.push((curr - prev) / 1000);
  }
  const mean = gaps.reduce((s, g) => s + g, 0) / gaps.length;
  const variance =
    gaps.reduce((s, g) => s + (g - mean) * (g - mean), 0) / gaps.length;
  return { mean_seconds: mean, variance_seconds: variance, n: gaps.length };
}

const RHYTHM_NUDGE: Record<AIAgentId, number> = {
  copilot: 0.14,
  cursor: 0.10,
  'claude-code': 0.06,
  windsurf: 0.04,
  devin: 0.00,
  codewhisperer: -0.04,
  tabnine: -0.06,
  'gpt-engineer': -0.02,
  human: -0.22,
  other: 0.00,
};

/**
 *
 */
export function extractEditHistoryRhythm(
  input: AttributionInput,
): SignalContribution {
  const { mean_seconds, variance_seconds, n } = commitGapStats(
    input.commit_metadata.timestamp_utc,
    input.commit_metadata.prior_commit_timestamps,
  );
  // Confidence ramps with N — fewer than 3 prior commits is low confidence.
  const extraction_confidence = Math.max(0, Math.min(1, n / 10));
  // Burst-pattern score: low mean + low variance = high AI nudge; high mean
  // OR high variance = pulls toward human. Score in [0, 1].
  const burstiness =
    mean_seconds === 0
      ? 0
      : Math.max(0, Math.min(1, 1 - mean_seconds / 3600));
  const stability =
    variance_seconds === 0
      ? 0
      : Math.max(0, Math.min(1, 1 - Math.sqrt(variance_seconds) / 3600));
  const ai_signal_strength = (burstiness + stability) / 2;
  const contributions_per_agent = scaleZeroSum(
    RHYTHM_NUDGE,
    extraction_confidence * ai_signal_strength,
  );
  return {
    signal_name: 'edit_history_rhythm',
    contributions_per_agent,
    raw_value: mean_seconds,
    extraction_confidence,
  };
}
