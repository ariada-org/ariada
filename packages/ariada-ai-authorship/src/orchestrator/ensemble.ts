// SPDX-License-Identifier: EUPL-1.2
//
// Ensemble combiner — sums per-signal log-odds contributions per agent into a
// single logit vector and adds a class prior. The output of this step feeds
// the calibration layer and finally the posterior projection.

import {
  ALL_AGENTS,
  type AIAgentId,
  type SignalContribution,
} from '../types.js';

/**
 * A small, uniform prior over agents. Production calibration moves it
 * toward the empirical class frequencies of the validation corpus; the OSS
 * reference implementation ships a uniform prior because the offline mode
 * has no per-customer calibration data.
 */
export const UNIFORM_PRIOR: Record<AIAgentId, number> = (() => {
  const p = {} as Record<AIAgentId, number>;
  for (const agent of ALL_AGENTS) p[agent] = 0;
  return p;
})();

/**
 * Default per-signal weights. All 1.0 in the OSS reference implementation —
 * production weights are calibrated against the held-out corpus and ship
 * with the closed classifier. Weights are EXPOSED here so a researcher can
 * inspect them, but the contract is «opaque scalar per signal».
 */
export const DEFAULT_SIGNAL_WEIGHTS = {
  lexical_entropy: 1.0,
  ast_shape: 1.0,
  naming_cadence: 1.0,
  edit_history_rhythm: 1.0,
} as const;

/**
 * Combine the per-signal contributions into a per-agent logit vector.
 * Returns a record keyed by agent id; missing agents are zero.
 */
export function combineLogits(
  contributions: SignalContribution[],
  prior: Record<AIAgentId, number> = UNIFORM_PRIOR,
  weights: Record<string, number> = DEFAULT_SIGNAL_WEIGHTS,
): Record<AIAgentId, number> {
  const logits = {} as Record<AIAgentId, number>;
  for (const agent of ALL_AGENTS) logits[agent] = prior[agent];
  for (const sig of contributions) {
    const w = weights[sig.signal_name] ?? 1.0;
    for (const agent of ALL_AGENTS) {
      const contrib = sig.contributions_per_agent[agent] ?? 0;
      logits[agent] += w * contrib;
    }
  }
  return logits;
}
