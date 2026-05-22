// SPDX-License-Identifier: EUPL-1.2
//
// Posterior projection — softmax over calibrated logits, then enforce the
// package output invariants (all-agents-present, probability-descending order,
// per-signal contribution-sum, and related constraints).

import {
  ALL_AGENTS,
  type AIAgentId,
  type AgentProbability,
} from '../types.js';

/**
 * Numerically-stable softmax. Subtracts max-logit before exponentiating to
 * avoid overflow on large positive logits.
 */
export function softmax(
  logits: Record<AIAgentId, number>,
): Record<AIAgentId, number> {
  let max = Number.NEGATIVE_INFINITY;
  for (const agent of ALL_AGENTS) {
    const v = logits[agent];
    if (v > max) max = v;
  }
  const exps = {} as Record<AIAgentId, number>;
  let sum = 0;
  for (const agent of ALL_AGENTS) {
    const e = Math.exp(logits[agent] - max);
    exps[agent] = e;
    sum += e;
  }
  const out = {} as Record<AIAgentId, number>;
  for (const agent of ALL_AGENTS) {
    out[agent] = exps[agent] / sum;
  }
  return out;
}

/**
 * Produce a sorted-descending posterior array from a softmax distribution.
 * All agents are present (the all-agents-present invariant). Ties are broken by the
 * canonical declaration order in `ALL_AGENTS` so the output is fully
 * deterministic.
 */
export function buildPosterior(
  probs: Record<AIAgentId, number>,
): AgentProbability[] {
  const entries: AgentProbability[] = ALL_AGENTS.map((agent) => ({
    agent,
    probability: probs[agent],
  }));
  entries.sort((a, b) => {
    if (b.probability !== a.probability) return b.probability - a.probability;
    return ALL_AGENTS.indexOf(a.agent) - ALL_AGENTS.indexOf(b.agent);
  });
  return entries;
}

/**
 * Compute a scalar confidence in [0, 1] from a posterior distribution.
 *
 * Combines (a) inverse Shannon entropy of the posterior (peaked = high
 * confidence) and (b) the top-1 probability. Maps both to [0, 1] then
 * averages.
 */
export function computeConfidence(probs: Record<AIAgentId, number>): number {
  let h = 0;
  let top = 0;
  for (const agent of ALL_AGENTS) {
    const p = probs[agent];
    if (p > 0) h += -p * Math.log2(p);
    if (p > top) top = p;
  }
  const maxH = Math.log2(ALL_AGENTS.length);
  const entropyTerm = maxH === 0 ? 1 : Math.max(0, 1 - h / maxH);
  return Math.max(0, Math.min(1, (entropyTerm + top) / 2));
}
