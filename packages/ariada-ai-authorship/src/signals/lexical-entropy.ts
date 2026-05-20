// SPDX-License-Identifier: EUPL-1.2
//
// Lexical entropy signal — information-theoretic measure of token-distribution
// surprisal in a source code sample. AI-generated code tends to cluster within
// a narrower lexical band than long-tail human code; the entropy measure
// captures one axis of that distribution gap.
//
// The implementation is deliberately small + reproducible. Closed-tier
// per-agent log-odds tables (held by the hosted service) consume the raw
// entropy value plus a language-specific calibration. The OSS reference
// implementation ships a coarse default table so offline-mode inference can
// produce a non-trivial posterior on its own.

import {
  ALL_AGENTS,
  type AIAgentId,
  type AttributionInput,
  type SignalContribution,
} from '../types.js';

/**
 * Tokenise a source-code hunk into an array of word-like tokens. The
 * tokenisation is intentionally language-agnostic — splitting on
 * non-alphanumeric, non-underscore boundaries — so the same primitive
 * applies to every language in the matrix.
 */
export function tokenise(code: string): string[] {
  if (code.length === 0) return [];
  // Split on any run of characters that is NOT alphanumeric or underscore.
  return code.split(/[^A-Za-z0-9_]+/u).filter((tok) => tok.length > 0);
}

/**
 * Shannon entropy (bits) of the token-distribution. Empty input returns 0.
 *
 * Reference: H(X) = -Σ p(x) · log₂ p(x).
 */
export function shannonEntropy(tokens: string[]): number {
  if (tokens.length === 0) return 0;
  const counts = new Map<string, number>();
  for (const tok of tokens) {
    counts.set(tok, (counts.get(tok) ?? 0) + 1);
  }
  const n = tokens.length;
  let h = 0;
  for (const c of counts.values()) {
    const p = c / n;
    h += -p * Math.log2(p);
  }
  return h;
}

/**
 * Coarse, OSS-distributed lexical-entropy weights per agent. These are
 * intentionally hand-tuned placeholder values that produce well-formed
 * non-degenerate contributions in offline mode. Production accuracy comes
 * from the closed calibration table behind the hosted endpoint.
 *
 * The vector is log-odds nudges — positive nudges are «more like this
 * agent at this entropy band», negative nudges are «less like». They sum
 * to zero across all agents within a single signal (§3.3-7 invariant).
 */
const ENTROPY_NUDGE: Record<AIAgentId, number> = {
  copilot: 0.20,
  cursor: 0.15,
  'claude-code': 0.10,
  windsurf: 0.05,
  devin: 0.00,
  codewhisperer: -0.05,
  tabnine: -0.10,
  'gpt-engineer': -0.05,
  human: -0.30,
  other: 0.00,
};

/**
 * Extract the lexical-entropy contribution for an input. Returns a
 * `SignalContribution` whose `raw_value` is the Shannon entropy in bits.
 *
 * The contribution per agent is the canonical nudge vector scaled by a
 * monotone factor of the entropy value. Entropy near zero (degenerate
 * input — empty, single token, all-identical) returns a low extraction
 * confidence.
 */
export function extractLexicalEntropy(
  input: AttributionInput,
): SignalContribution {
  const tokens = tokenise(input.code);
  const entropy = shannonEntropy(tokens);
  // Extraction confidence: 0 for degenerate inputs, ramping linearly to 1
  // at entropy >= 4 bits. Caps at 1.
  const extraction_confidence = Math.max(0, Math.min(1, entropy / 4));
  // Scale nudges by extraction confidence — degenerate input contributes
  // zero. Re-center to keep zero-sum invariant.
  const contributions_per_agent = scaleZeroSum(ENTROPY_NUDGE, extraction_confidence);
  return {
    signal_name: 'lexical_entropy',
    contributions_per_agent,
    raw_value: entropy,
    extraction_confidence,
  };
}

/**
 * Scale a zero-sum nudge vector by `factor` while preserving zero-sum.
 *
 * Used by the signal extractors to keep §3.3-7 invariant («per-signal
 * contributions in log-odds space sum approximately to zero») while
 * letting low-confidence extractions contribute near-zero evidence.
 */
export function scaleZeroSum(
  nudge: Record<AIAgentId, number>,
  factor: number,
): Record<AIAgentId, number> {
  const scaled = {} as Record<AIAgentId, number>;
  let sum = 0;
  for (const agent of ALL_AGENTS) {
    const raw = nudge[agent];
    const scaledValue = raw * factor;
    scaled[agent] = scaledValue;
    sum += scaledValue;
  }
  // Re-center to enforce zero-sum after potential drift from floating point.
  const offset = sum / ALL_AGENTS.length;
  for (const agent of ALL_AGENTS) {
    scaled[agent] -= offset;
  }
  return scaled;
}
