// SPDX-License-Identifier: EUPL-1.2
//
// PR comment rendering test. The upstream GitHub Action renders the
// attribution as a Markdown table showing the top-3 agents with percentages
// plus the confidence + a methodology link. This test exercises a small
// rendering helper kept in-tree so the contract is testable without a
// upstream dependency. Snapshot-style: deterministic format + stable shape.

import { describe, it, expect } from 'vitest';

import { buildPosterior } from '../../src/orchestrator/posterior.js';
import {
  ALL_AGENTS,
  type AIAgentId,
  type AttributionPosterior,
} from '../../src/types.js';

/** Render a posterior as a top-3 Markdown table. */
export function renderTopThreeMarkdown(
  posterior: AttributionPosterior,
  docsUrl = 'https://ariada.org/packages/ai-authorship',
): string {
  const head = posterior.posterior.slice(0, 3);
  const rows = head.map(
    (e) => `| ${e.agent} | ${(e.probability * 100).toFixed(1)}% |`,
  );
  return [
    '| agent | probability |',
    '| --- | --- |',
    ...rows,
    '',
    `confidence: ${(posterior.confidence * 100).toFixed(1)}%`,
    `methodology: ${docsUrl}`,
  ].join('\n');
}

describe('PR comment rendering', () => {
  it('renders a stable Markdown table for a known posterior', () => {
    const probs = Object.fromEntries(
      ALL_AGENTS.map((a, i) => [a, (ALL_AGENTS.length - i) / 55]),
    ) as Record<AIAgentId, number>;
    const posterior: AttributionPosterior = {
      posterior: buildPosterior(probs),
      confidence: 0.42,
      signal_contributions: [],
      classifier_version: '0.1.0-oss-default',
      calibration_version: '0.1.0-oss-default',
      inferred_at_utc: '2026-05-20T12:00:00.000Z',
      inference_mode: 'offline',
    };
    const md = renderTopThreeMarkdown(posterior);
    expect(md).toContain('| agent | probability |');
    expect(md).toContain('confidence: 42.0%');
    expect(md.split('\n').filter((l) => l.startsWith('|'))).toHaveLength(5);
    expect(md).toContain(
      'methodology: https://ariada.org/packages/ai-authorship',
    );
  });
});
