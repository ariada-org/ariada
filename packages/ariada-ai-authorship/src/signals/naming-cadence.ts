// SPDX-License-Identifier: EUPL-1.2
//
// Naming-cadence signal — captures the identifier-naming-style rhythm of a
// code hunk. AI-tool output tends to a more uniform identifier-style mixture
// (predominantly camelCase or snake_case depending on language) than human
// output, which mixes styles within a single hunk more freely.

import type {
  AIAgentId,
  AttributionInput,
  SignalContribution,
} from '../types.js';

import { tokenise , scaleZeroSum } from './lexical-entropy.js';

/** Classify an identifier into a style bucket. */
export function identifierStyle(
  identifier: string,
): 'camelCase' | 'snake_case' | 'PascalCase' | 'SCREAMING' | 'lowercase' | 'mixed' | 'other' {
  if (identifier.length === 0) return 'other';
  if (/^[A-Z][A-Z0-9_]*$/u.test(identifier)) return 'SCREAMING';
  if (/^[a-z][a-z0-9]*$/u.test(identifier)) return 'lowercase';
  if (/^[a-z][a-zA-Z0-9]*$/u.test(identifier) && /[A-Z]/u.test(identifier))
    return 'camelCase';
  if (/^[A-Z][a-zA-Z0-9]*$/u.test(identifier) && /[a-z]/u.test(identifier))
    return 'PascalCase';
  if (/_/u.test(identifier) && /^[a-z]/u.test(identifier)) return 'snake_case';
  return 'mixed';
}

/**
 * Compute the Shannon entropy over the distribution of identifier styles in
 * the input. Lower entropy = more uniform naming = stronger AI signal.
 */
export function styleEntropy(tokens: string[]): number {
  if (tokens.length === 0) return 0;
  const counts = new Map<string, number>();
  for (const tok of tokens) {
    const style = identifierStyle(tok);
    counts.set(style, (counts.get(style) ?? 0) + 1);
  }
  const n = tokens.length;
  let h = 0;
  for (const c of counts.values()) {
    const p = c / n;
    h += -p * Math.log2(p);
  }
  return h;
}

const NAMING_NUDGE: Record<AIAgentId, number> = {
  copilot: 0.16,
  cursor: 0.12,
  'claude-code': 0.08,
  windsurf: 0.04,
  devin: 0.00,
  codewhisperer: -0.04,
  tabnine: -0.08,
  'gpt-engineer': -0.04,
  human: -0.24,
  other: 0.00,
};

/**
 *
 */
export function extractNamingCadence(
  input: AttributionInput,
): SignalContribution {
  const tokens = tokenise(input.code);
  const ident_tokens = tokens.filter((t) => /^[A-Za-z_]/u.test(t));
  const entropy = styleEntropy(ident_tokens);
  // Higher entropy = more human; map to a confidence-scaled contribution.
  // Confidence ramps with number of identifier tokens — < 5 idents is low.
  const extraction_confidence = Math.max(0, Math.min(1, ident_tokens.length / 20));
  // Use (max_entropy - observed) as a uniformity score in [0, max_entropy].
  // log2(7) covers the 7 style buckets.
  const max_entropy = Math.log2(7);
  const uniformity = Math.max(0, max_entropy - entropy);
  const scale = uniformity / max_entropy;
  const contributions_per_agent = scaleZeroSum(
    NAMING_NUDGE,
    extraction_confidence * scale,
  );
  return {
    signal_name: 'naming_cadence',
    contributions_per_agent,
    raw_value: entropy,
    extraction_confidence,
  };
}
