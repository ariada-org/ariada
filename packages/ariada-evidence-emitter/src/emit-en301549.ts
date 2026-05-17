// SPDX-License-Identifier: EUPL-1.2
/**
 * EN 301 549 v3.2.1 §11 Conformance Statement JSON emitter.
 *
 * §11 covers software (web content). Clauses 11.x.y.z mirror WCAG 2.x SC x.y.z
 * (per Annex A.3 mapping table). This emitter projects normalized violations
 * onto a §11 clause grid and produces a JSON conformance statement.
 *
 * @see https://www.etsi.org/deliver/etsi_en/301500_301599/301549/03.02.01_60/en_301549v030201p.pdf
 */

import type {
  Violation,
  ReportMeta,
  En301549Report,
  En301549Row,
  En301549Status,
} from './types.js';
import { WCAG_22_CRITERIA, WCAG_BY_SC } from './wcag-22-catalog.js';

interface BucketEntry {
  count: number;
  maxImpact: 'minor' | 'moderate' | 'serious' | 'critical';
  totalNodes: number;
}

const IMPACT_RANK = { minor: 1, moderate: 2, serious: 3, critical: 4 } as const;

function maxImpact(
  a: BucketEntry['maxImpact'],
  b: BucketEntry['maxImpact'],
): BucketEntry['maxImpact'] {
  return IMPACT_RANK[a] >= IMPACT_RANK[b] ? a : b;
}

/**
 * Convert a WCAG SC (e.g. "1.4.3") to its mirrored EN 301 549 §11 clause
 * (e.g. "11.1.4.3"). Returns null if mapping is not applicable.
 */
function wcagToEn301549Clause(sc: string): string | null {
  // Match x.y.z numeric form
  if (!/^\d+\.\d+\.\d+$/.test(sc)) return null;
  return `11.${sc}`;
}

function bucketViolationsByClause(violations: Violation[]): Map<string, BucketEntry> {
  const m = new Map<string, BucketEntry>();
  const add = (clause: string, v: Violation): void => {
    const existing = m.get(clause);
    const nodes = v.nodeCount ?? 1;
    if (existing) {
      existing.count += 1;
      existing.maxImpact = maxImpact(existing.maxImpact, v.impact);
      existing.totalNodes += nodes;
    } else {
      m.set(clause, { count: 1, maxImpact: v.impact, totalNodes: nodes });
    }
  };

  for (const v of violations) {
    // Direct §11 clauses take precedence
    if (v.en301549 && v.en301549.length > 0) {
      for (const c of v.en301549) add(c, v);
      continue;
    }
    // Otherwise derive from WCAG SC
    for (const sc of v.wcag) {
      const clause = wcagToEn301549Clause(sc);
      if (clause) add(clause, v);
    }
  }
  return m;
}

function statusFromBucket(b: BucketEntry | undefined): En301549Status {
  if (!b) return 'conformant';
  if (b.maxImpact === 'critical' || b.maxImpact === 'serious') return 'non-conformant';
  return 'partially-conformant';
}

function buildClauseRow(sc: string, bucket: Map<string, BucketEntry>): En301549Row {
  const clause = `11.${sc}`;
  const b = bucket.get(clause);
  const wcag = WCAG_BY_SC.get(sc);
  const row: En301549Row = {
    clause,
    title: wcag?.name ?? '(no title)',
    wcag: [sc],
    status: statusFromBucket(b),
    issueCount: b?.count ?? 0,
    remarks: b
      ? `Max impact ${b.maxImpact}; ${b.totalNodes} affected node(s) across ${b.count} rule(s).`
      : '',
  };
  return row;
}

/**
 * Emit an EN 301 549 v3.2.1 §11 Conformance Statement JSON.
 */
export function emitEn301549(violations: Violation[], meta: ReportMeta): En301549Report {
  const bucket = bucketViolationsByClause(violations);
  const clauses: En301549Row[] = WCAG_22_CRITERIA.map((c) => buildClauseRow(c.sc, bucket));

  // Pick up extra clauses cited directly (e.g. 11.7 user preferences, 11.8.x authoring tool)
  // that don't have a WCAG-SC mirror.
  for (const [clause, b] of bucket.entries()) {
    if (clauses.some((row) => row.clause === clause)) continue;
    clauses.push({
      clause,
      title: '(no WCAG mirror — see EN 301 549 §11)',
      status: statusFromBucket(b),
      issueCount: b.count,
      remarks: `Direct §11 clause violation; max impact ${b.maxImpact}.`,
    });
  }

  const summary = {
    total: clauses.length,
    conformant: 0,
    partiallyConformant: 0,
    nonConformant: 0,
    notApplicable: 0,
    notEvaluated: 0,
  };
  for (const c of clauses) {
    switch (c.status) {
      case 'conformant':
        summary.conformant += 1;
        break;
      case 'partially-conformant':
        summary.partiallyConformant += 1;
        break;
      case 'non-conformant':
        summary.nonConformant += 1;
        break;
      case 'not-applicable':
        summary.notApplicable += 1;
        break;
      case 'not-evaluated':
        summary.notEvaluated += 1;
        break;
    }
  }

  return {
    $schema: 'https://schemas.ariada.org/en301549/3.2.1.json',
    schemaVersion: '3.2.1',
    meta,
    clauses,
    summary,
  };
}