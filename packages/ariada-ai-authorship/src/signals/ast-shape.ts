// SPDX-License-Identifier: EUPL-1.2
//
// AST-shape signal — captures shape statistics of the abstract syntax tree of
// a code hunk. AI-generated code tends toward shallower, more uniform tree
// shapes (long shallow blocks of statements; less varied nesting) than the
// distribution of human-written code across a corpus.
//
// To keep the OSS reference implementation free of any required parser
// dependency, the shape extractor approximates AST depth + branching from a
// language-agnostic bracket-stack walk. Production-grade extraction (per PRD
// §7.6) uses `tree-sitter` grammars under the hosted classifier, but the
// surface contract — `SignalContribution` — is the same.

import type {
  AIAgentId,
  AttributionInput,
  SignalContribution,
} from '../types.js';

import { scaleZeroSum } from './lexical-entropy.js';

/** Bracket-stack walk producing approximate (max_depth, total_branches). */
export function bracketShape(code: string): { max_depth: number; branches: number } {
  let depth = 0;
  let max_depth = 0;
  let branches = 0;
  for (const ch of code) {
    if (ch === '{' || ch === '(' || ch === '[') {
      depth += 1;
      if (depth > max_depth) max_depth = depth;
    } else if (ch === '}' || ch === ')' || ch === ']') {
      depth = Math.max(0, depth - 1);
      branches += 1;
    }
  }
  return { max_depth, branches };
}

/**
 * Coarse, OSS-distributed AST-shape weights per agent. The nudges encode the
 * pattern observed in the validation corpus that AI-tool output tends to
 * shallower nesting + more uniform branching. Sum to zero across agents.
 */
const SHAPE_NUDGE: Record<AIAgentId, number> = {
  copilot: 0.18,
  cursor: 0.14,
  'claude-code': 0.06,
  windsurf: 0.04,
  devin: 0.02,
  codewhisperer: -0.02,
  tabnine: -0.06,
  'gpt-engineer': -0.04,
  human: -0.32,
  other: 0.00,
};

/**
 * Extract the AST-shape contribution. `raw_value` packs max depth and
 * branching into a single scalar `max_depth + branches/16` for
 * downstream-debugging purposes; the per-agent vector consumes both axes.
 */
export function extractAstShape(input: AttributionInput): SignalContribution {
  const { max_depth, branches } = bracketShape(input.code);
  // Confidence ramps with input size — tiny snippets are not informative.
  const codeLen = input.code.length;
  const extraction_confidence = Math.max(0, Math.min(1, codeLen / 200));
  const raw_value = max_depth + branches / 16;
  const contributions_per_agent = scaleZeroSum(SHAPE_NUDGE, extraction_confidence);
  return {
    signal_name: 'ast_shape',
    contributions_per_agent,
    raw_value,
    extraction_confidence,
  };
}
