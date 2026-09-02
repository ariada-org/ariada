// SPDX-License-Identifier: EUPL-1.2
/**
 * Voluntary Product Accessibility Template (VPAT) 2.5 JSON emitter.
 *
 * VPAT is the standard US Section 508 / ITI conformance reporting format.
 * This emitter produces a JSON-serialisable representation of the WCAG 2.x
 * conformance table (the largest section in modern VPAT reports) suitable
 * for downstream rendering into HTML / DOCX / PDF.
 *
 * @see https://www.itic.org/policy/accessibility/vpat (VPAT 2.5 spec)
 * @see https://www.section508.gov (Section 508 baseline)
 */

import type { Violation, ReportMeta, VpatReport, VpatCriterion, VpatConformanceLevel } from './types.js';
import { WCAG_22_CRITERIA } from './wcag-22-catalog.js';

interface BucketEntry {
  count: number;
  totalNodes: number;
  maxImpact: 'minor' | 'moderate' | 'serious' | 'critical';
  ids: string[];
}

const IMPACT_RANK: Record<BucketEntry['maxImpact'], number> = {
  minor: 1,
  moderate: 2,
  serious: 3,
  critical: 4,
};

function impactMax(a: BucketEntry['maxImpact'], b: BucketEntry['maxImpact']): BucketEntry['maxImpact'] {
  return IMPACT_RANK[a] >= IMPACT_RANK[b] ? a : b;
}

function bucketViolationsBySc(violations: Violation[]): Map<string, BucketEntry> {
  const m = new Map<string, BucketEntry>();
  for (const v of violations) {
    const nodes = v.nodeCount ?? 1;
    for (const sc of v.wcag) {
      const existing = m.get(sc);
      if (existing) {
        existing.count += 1;
        existing.totalNodes += nodes;
        existing.maxImpact = impactMax(existing.maxImpact, v.impact);
        existing.ids.push(v.id);
      } else {
        m.set(sc, {
          count: 1,
          totalNodes: nodes,
          maxImpact: v.impact,
          ids: [v.id],
        });
      }
    }
  }
  return m;
}

/**
 * Turn what was found against one criterion into a conformance level.
 *
 * A criterion with no recorded violation is reported as *not evaluated*, not as
 * supported. Automated checking reaches a minority of the success criteria, so
 * an empty bucket means "nothing automatable was found here" — which is also
 * what a page that failed to load, or a criterion no rule covers, produces.
 * Reading that as conformance turned silence into a claim, in a document a
 * supervisory body relies on.
 *
 * "Supports" is reserved for a criterion a rule actually exercised and passed,
 * which the caller marks explicitly.
 */
function conformanceFromBucket(b: BucketEntry | undefined, evaluated: boolean): VpatConformanceLevel {
  if (!b) {
    return evaluated ? 'Supports' : 'Not Evaluated';
  }
  if (b.maxImpact === 'critical' || b.maxImpact === 'serious') {
    return 'Does Not Support';
  }
  return 'Partially Supports';
}

function remarksFromBucket(b: BucketEntry | undefined): string {
  if (!b) return '';
  const verb = b.count === 1 ? 'violation' : 'violations';
  const nodes = b.totalNodes === 1 ? 'affected node' : 'affected nodes';
  return `${b.count} ${verb} detected (${b.totalNodes} ${nodes}); max impact: ${b.maxImpact}. Rule IDs: ${b.ids.join(', ')}.`;
}

/**
 * Emit a VPAT 2.5 JSON report.
 *
 * @param violations - Normalized violation records (subset of axe-core Result).
 * @param meta - Report metadata (product, evaluator, date, scope).
 * @returns JSON-serialisable {@link VpatReport}.
 */
export function emitVpat(
  violations: Violation[],
  meta: ReportMeta,
  /**
   * Criteria a rule actually exercised and found nothing wrong with. Only these
   * may be reported as supported; everything else with no violation is reported
   * as not evaluated. Omit it and the report claims nothing it cannot show —
   * which is the safe default for a scan that does not yet record its passes.
   */
  evaluatedCriteria: ReadonlySet<string> = new Set(),
): VpatReport {
  const bucket = bucketViolationsBySc(violations);
  const criteria: VpatCriterion[] = WCAG_22_CRITERIA.map((c) => {
    const b = bucket.get(c.sc);
    return {
      criterion: c.sc,
      name: c.name,
      level: c.level,
      conformance: conformanceFromBucket(b, evaluatedCriteria.has(c.sc)),
      remarks: remarksFromBucket(b),
    };
  });

  const summary = {
    total: criteria.length,
    supports: 0,
    partiallySupports: 0,
    doesNotSupport: 0,
    notApplicable: 0,
    notEvaluated: 0,
  };
  for (const c of criteria) {
    switch (c.conformance) {
      case 'Supports':
        summary.supports += 1;
        break;
      case 'Partially Supports':
        summary.partiallySupports += 1;
        break;
      case 'Does Not Support':
        summary.doesNotSupport += 1;
        break;
      case 'Not Applicable':
        summary.notApplicable += 1;
        break;
      case 'Not Evaluated':
        summary.notEvaluated += 1;
        break;
    }
  }

  return {
    $schema: 'https://schemas.ariada.org/vpat/2.5.json',
    schemaVersion: '2.5',
    meta,
    applicableStandards: [
      'WCAG 2.2 Level AA (W3C Recommendation)',
      'EN 301 549 v3.2.1 Chapter 9 (Web content)',
      'US Section 508 (Revised 36 CFR 1194)',
    ],
    criteria,
    summary,
  };
}