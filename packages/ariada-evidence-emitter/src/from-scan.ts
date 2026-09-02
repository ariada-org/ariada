// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

/**
 * Turning a scan into the input a conformance report needs.
 *
 * This lived inside the command-line tool, which meant the browser panel could
 * not produce a report at all — it offered a raw JSON download instead, whose
 * only use was to be carried to a terminal by hand. Worse, a second copy of the
 * mapping would have drifted from the first, which is exactly how the criterion
 * codes ended up in three incompatible notations.
 *
 * So the mapping lives here, with no dependencies, and both callers use it.
 */

import type { Violation } from './types.js';

/** The shape this module needs from a scan — declared structurally so the
 *  package stays dependency-free and usable from a browser bundle. */
export interface ScanLikeFinding {
  readonly domain?: string;
  readonly ruleId: string;
  readonly message?: string;
  readonly severity?: string;
  readonly criterion?: string;
  readonly wcagMapping?: readonly string[];
  readonly regulatoryMapping?: ReadonlyArray<{ framework: string; code: string }>;
  readonly element?: { readonly selector?: string };
}

/**
 *
 */
export interface ScanLikeReport {
  readonly sites: readonly string[];
  readonly domains: readonly string[];
  readonly grid: Readonly<Record<string, Record<string, readonly ScanLikeFinding[]>>>;
}

/**
 * Reduce a criterion code to the bare dotted form used as a bucket key.
 *
 * The same criterion arrives written three ways: bare from the rule packs
 * (`1.1.1`), prefixed from the regulatory mapping (`SC 1.1.1`), and — before
 * this was fixed at the source — with the separators missing (`412`). They are
 * matched by exact string, so an unnormalised code produced a bucket matching
 * no criterion, and the report then declared that criterion supported while the
 * scan beneath it listed the violations.
 */
export function canonicalCriterion(code: string): string {
  const bare = code.trim().replace(/^(SC|WCAG)\s+/i, '');
  // A run of digits with no separators is the older notation: first digit is the
  // principle, second the guideline, the rest the criterion number.
  const runTogether = /^(\d)(\d)(\d+)$/.exec(bare);
  return runTogether ? `${runTogether[1]}.${runTogether[2]}.${runTogether[3]}` : bare;
}

/**
 *
 */
export function criteriaOf(finding: ScanLikeFinding): string[] {
  const direct = finding.wcagMapping ?? [];
  const regulatory =
    finding.regulatoryMapping?.filter((r) => r.framework === 'WCAG').map((r) => r.code) ?? [];
  return [...new Set([...direct, ...regulatory].map(canonicalCriterion))];
}

/**
 *
 */
export function europeanClausesOf(finding: ScanLikeFinding): string[] {
  return (
    finding.regulatoryMapping?.filter((r) => r.framework === 'EN 301 549').map((r) => r.code) ?? []
  );
}

/**
 *
 */
export function allFindings(report: ScanLikeReport): ScanLikeFinding[] {
  const out: ScanLikeFinding[] = [];
  for (const site of report.sites) {
    for (const domain of report.domains) out.push(...(report.grid[site]?.[domain] ?? []));
  }
  return out;
}

/**
 * Accessibility findings that carry at least one criterion, as violations.
 *
 * A finding with no criterion is not silently dropped from the reader's view —
 * {@link countUnmapped} reports how many there were, so the report can say that
 * some of what was found could not be placed against a criterion.
 */
export function findingsToViolations(report: ScanLikeReport): Violation[] {
  const violations: Violation[] = [];
  for (const finding of allFindings(report)) {
    if (finding.domain !== undefined && finding.domain !== 'accessibility') continue;
    const wcag = criteriaOf(finding);
    if (wcag.length === 0) continue;
    violations.push({
      id: finding.ruleId,
      description: finding.message ?? '',
      help: finding.message ?? '',
      impact: (finding.severity ?? 'moderate') as Violation['impact'],
      wcag,
      en301549: europeanClausesOf(finding),
      nodeCount: 1,
      sampleSelectors: finding.element?.selector ? [finding.element.selector] : [],
    });
  }
  return violations;
}

/** How many accessibility findings could not be placed against any criterion. */
export function countUnmapped(report: ScanLikeReport): number {
  return allFindings(report).filter(
    (f) => (f.domain === undefined || f.domain === 'accessibility') && criteriaOf(f).length === 0,
  ).length;
}
