// SPDX-License-Identifier: EUPL-1.2
//
// Differential-threshold handshake test. The differential-threshold logic reads
// `posterior[0].agent` + `posterior[0].probability` without parsing free-text.
// This test exercises that exact contract: route to «strict» when
// posterior[0].probability >= 0.6 && posterior[0].agent !== 'human'.

import { describe, it, expect } from 'vitest';

import { buildPosterior } from '../../src/orchestrator/posterior.js';
import { ALL_AGENTS, type AIAgentId } from '../../src/types.js';

type Policy = 'strict' | 'standard';

/**
 * Reference implementation of the upstream routing predicate. Documented
 * here in-tree so the contract is testable without an upstream dependency.
 */
export function routeFinding(
  posterior: { agent: AIAgentId; probability: number }[],
  threshold = 0.6,
): Policy {
  const top = posterior[0];
  if (top === undefined) return 'standard';
  if (top.probability >= threshold && top.agent !== 'human') return 'strict';
  return 'standard';
}

function makePosterior(
  weights: Partial<Record<AIAgentId, number>>,
): { agent: AIAgentId; probability: number }[] {
  const probs = Object.fromEntries(
    ALL_AGENTS.map((a) => [a, weights[a] ?? 0]),
  ) as Record<AIAgentId, number>;
  const sum = ALL_AGENTS.reduce((s, a) => s + probs[a], 0);
  const norm = Object.fromEntries(
    ALL_AGENTS.map((a) => [a, probs[a] / sum]),
  ) as Record<AIAgentId, number>;
  return buildPosterior(norm);
}

describe('differential-threshold handshake', () => {
  it('routes to strict when top is an AI agent above threshold', () => {
    const posterior = makePosterior({ copilot: 0.8, human: 0.2 });
    expect(posterior[0]?.agent).toBe('copilot');
    expect(routeFinding(posterior)).toBe('strict');
  });

  it('routes to standard when top is human', () => {
    const posterior = makePosterior({ human: 0.7, copilot: 0.3 });
    expect(posterior[0]?.agent).toBe('human');
    expect(routeFinding(posterior)).toBe('standard');
  });

  it('routes to standard when AI agent is above threshold but tied with human at top', () => {
    const posterior = makePosterior({ copilot: 0.5, human: 0.5 });
    // Ties are broken by canonical declaration order — copilot wins.
    expect(posterior[0]?.agent).toBe('copilot');
    expect(routeFinding(posterior)).toBe('standard');
  });

  it('respects a custom threshold', () => {
    const posterior = makePosterior({ cursor: 0.55, human: 0.45 });
    expect(routeFinding(posterior, 0.6)).toBe('standard');
    expect(routeFinding(posterior, 0.5)).toBe('strict');
  });
});
