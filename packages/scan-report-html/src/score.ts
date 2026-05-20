// SPDX-License-Identifier: EUPL-1.2
// SPDX-FileCopyrightText: 2026 Agonist Development AB
/**
 * Compliance-score heuristic per PRD §3.5.
 *
 *   score = max(0, 100 - sum(weight_per_violation * affected_nodes))
 *   weight = { critical: 10, serious: 5, moderate: 2, minor: 1 }
 *
 * This is explicitly labelled a heuristic in the rendered report — the
 * canonical signed score lives in Module D (Wave 2 PRD). The renderer's
 * value exists to give the compliance officer persona one comparable
 * number across scans (US-C1).
 */

import type { ScanFinding, Severity } from './types.js';

/**
 *
 */
export type ScoreBand = 'compliant' | 'work-in-progress' | 'non-compliant';

const SEVERITY_WEIGHT: Readonly<Record<Severity, number>> = {
  critical: 10,
  serious: 5,
  moderate: 2,
  minor: 1,
};

/**
 * Compute the compliance score for a list of findings. Integer in [0, 100].
 */
export function computeComplianceScore(findings: readonly ScanFinding[]): number {
  let penalty = 0;
  for (const finding of findings) {
    const weight = SEVERITY_WEIGHT[finding.impact];
    const nodeCount = finding.nodes.length === 0 ? 1 : finding.nodes.length;
    penalty += weight * nodeCount;
  }
  return Math.max(0, Math.min(100, 100 - penalty));
}

/**
 * Map a score to a colour band — used by the rendered gauge.
 *
 *   90-100 → compliant (green)
 *   70-89  → work-in-progress (amber)
 *    0-69  → non-compliant (red)
 */
export function bandFromScore(score: number): ScoreBand {
  if (score >= 90) {
    return 'compliant';
  }
  if (score >= 70) {
    return 'work-in-progress';
  }
  return 'non-compliant';
}

/**
 * Compute the prioritised top-N action items per PRD §3.5.2.
 *
 *   priority = severity_weight * affected_nodes
 *   top_N = sort_desc(findings, priority).slice(0, N)
 */
export function topActionItems(
  findings: readonly ScanFinding[],
  limit: number,
): readonly ScanFinding[] {
  const scored = findings.map((finding) => {
    const weight = SEVERITY_WEIGHT[finding.impact];
    const nodeCount = finding.nodes.length === 0 ? 1 : finding.nodes.length;
    return { finding, priority: weight * nodeCount };
  });
  scored.sort((a, b) => b.priority - a.priority);
  return scored.slice(0, limit).map((entry) => entry.finding);
}

/**
 * Count findings per severity bucket — used by the breakdown bars.
 */
export function severityBreakdown(
  findings: readonly ScanFinding[],
): Readonly<Record<Severity, number>> {
  const breakdown: Record<Severity, number> = {
    critical: 0,
    serious: 0,
    moderate: 0,
    minor: 0,
  };
  for (const finding of findings) {
    breakdown[finding.impact] += 1;
  }
  return breakdown;
}
