// SPDX-License-Identifier: EUPL-1.2
// SPDX-FileCopyrightText: 2026 Agonist Development AB
/**
 * Unit tests for the compliance-score heuristic.
 *
 * The formula is intentionally simple and table-driven; tests anchor it
 * before we trust it across a hundred ScanFinding fixtures.
 */

import { describe, expect, it } from 'vitest';

import {
  bandFromScore,
  computeComplianceScore,
  severityBreakdown,
  topActionItems,
} from '../../src/score.js';
import type { ScanFinding } from '../../src/types.js';

function finding(impact: ScanFinding['impact'], nodeCount: number): ScanFinding {
  return {
    id: `${impact}-rule`,
    impact,
    description: `${impact} description`,
    help: 'help text',
    wcag: ['1.4.3'],
    nodes: Array.from({ length: nodeCount }, (_, i) => ({ selector: `#n${i}` })),
  };
}

describe('computeComplianceScore', () => {
  it('returns 100 when there are no findings', () => {
    expect(computeComplianceScore([])).toBe(100);
  });

  it('penalises critical findings 10× per node', () => {
    expect(computeComplianceScore([finding('critical', 1)])).toBe(90);
    expect(computeComplianceScore([finding('critical', 3)])).toBe(70);
  });

  it('penalises serious findings 5× per node', () => {
    expect(computeComplianceScore([finding('serious', 2)])).toBe(90);
  });

  it('penalises moderate findings 2× per node', () => {
    expect(computeComplianceScore([finding('moderate', 4)])).toBe(92);
  });

  it('penalises minor findings 1× per node', () => {
    expect(computeComplianceScore([finding('minor', 5)])).toBe(95);
  });

  it('floors the score at 0 when the penalty exceeds 100', () => {
    expect(computeComplianceScore([finding('critical', 20)])).toBe(0);
  });

  it('treats findings with zero nodes as a single occurrence', () => {
    const zeroNodeFinding: ScanFinding = {
      id: 'oddball',
      impact: 'serious',
      description: 'zero-node finding',
      help: '',
      wcag: [],
      nodes: [],
    };
    expect(computeComplianceScore([zeroNodeFinding])).toBe(95);
  });
});

describe('bandFromScore', () => {
  it('maps 90+ → compliant', () => {
    expect(bandFromScore(100)).toBe('compliant');
    expect(bandFromScore(90)).toBe('compliant');
  });
  it('maps 70..89 → work-in-progress', () => {
    expect(bandFromScore(89)).toBe('work-in-progress');
    expect(bandFromScore(70)).toBe('work-in-progress');
  });
  it('maps 0..69 → non-compliant', () => {
    expect(bandFromScore(69)).toBe('non-compliant');
    expect(bandFromScore(0)).toBe('non-compliant');
  });
});

describe('topActionItems', () => {
  it('sorts findings by priority (severity_weight × node_count) descending', () => {
    const findings: ScanFinding[] = [
      finding('minor', 5), // priority 5
      finding('critical', 1), // priority 10
      finding('serious', 4), // priority 20
      finding('moderate', 3), // priority 6
    ];
    const top = topActionItems(findings, 3);
    expect(top).toHaveLength(3);
    expect(top[0]?.impact).toBe('serious');
    expect(top[1]?.impact).toBe('critical');
    expect(top[2]?.impact).toBe('moderate');
  });
});

describe('severityBreakdown', () => {
  it('counts findings per severity bucket', () => {
    const findings: ScanFinding[] = [
      finding('critical', 1),
      finding('critical', 2),
      finding('serious', 1),
      finding('minor', 4),
    ];
    expect(severityBreakdown(findings)).toEqual({
      critical: 2,
      serious: 1,
      moderate: 0,
      minor: 1,
    });
  });
});
