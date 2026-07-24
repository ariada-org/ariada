// SPDX-License-Identifier: EUPL-1.2
//
// GateDecision schema. The decision is the contract surface every
// CI runner consumes. The closed signer service signs the canonical JSON
// of this object and may anchor the hash into a tamper-evident
// evidence stream.

import {
  resolvePolicy,
  type BaselinePolicy,
  type PolicyAction,
} from './baseline-policy.js';
import type {
  Classification,
  ClassificationCounts,
  DiffResult,
  FindingWithFingerprint,
} from './diff-result.js';
import type { Severity } from './fingerprint.js';
import { sha256Hex } from './internal/hash.js';
import { canonicalize } from './internal/jcs-encode.js';

/** Schema version this package implements. */
export const GATE_DECISION_VERSION = '1.0.0';

/**
 *
 */
export interface DecisionReason {
  severity: Severity;
  classification: Classification;
  count: number;
  action: PolicyAction;
  applied_rule: {
    source: 'defaults' | 'path_overrides' | 'jurisdiction_overrides';
    reference: string;
  };
  sample_finding_ids: string[];
  /**
   * Present (and `true`) only when this reason aggregates needs-manual-review
   * findings (see `Finding.needsReview`) rather than definite violations.
   * Omitted for the common definite-violation case to keep existing
   * consumers unaffected.
   */
  needsReview?: boolean;
}

/**
 *
 */
export interface ExemptionApplied {
  fingerprint: string;
  expires_at: string;
  dom_stable: boolean;
}

/**
 *
 */
export interface ExemptionInvalidated {
  fingerprint: string;
  reason: 'expired' | 'dom_drift' | 'manually_revoked';
}

/**
 *
 */
export interface GateDecision {
  decision_id: string;
  decision_version: string;
  decided_at: string;
  diff_id: string;
  policy_version_hash: string;
  result: 'pass' | 'fail' | 'warn';
  reasons: DecisionReason[];
  counts: ClassificationCounts;
  exemptions_applied: ExemptionApplied[];
  exemptions_invalidated: ExemptionInvalidated[];
  recommended_action: string;
  report_url?: string;
  haes_anchor_intent?: 'anchor' | 'skip';
}

/**
 *
 */
export interface BuildGateDecisionInput {
  diff: DiffResult;
  policy: BaselinePolicy;
  /** Pre-allocated decision ID (ULID); caller provides for determinism. */
  decisionId: string;
  /** ISO 8601 UTC timestamp; caller provides for determinism in tests. */
  decidedAt: string;
  /** Optional explicit path context for path-override resolution. */
  path?: string;
  /** Optional explicit haes anchor intent. */
  haesAnchorIntent?: 'anchor' | 'skip';
  /** Optional report URL. */
  reportUrl?: string;
  /** Currently-applied exemptions (closed engine fills in `dom_stable`). */
  exemptionsApplied?: ExemptionApplied[];
  /** Exemptions invalidated for this decision. */
  exemptionsInvalidated?: ExemptionInvalidated[];
}

/**
 * Build a deterministic GateDecision from a DiffResult + BaselinePolicy.
 *
 * The function aggregates findings by (severity, classification), resolves
 * the applicable policy rule for each group, and synthesises the decision
 * result (`pass` / `fail` / `warn`).
 */
export function buildGateDecision(input: BuildGateDecisionInput): GateDecision {
  const reasons: DecisionReason[] = [];

  for (const cls of ['new', 'pre_existing', 'resolved'] as const) {
    const findings = input.diff.classification[cls];
    if (!findings || findings.length === 0) continue;
    const grouped = groupBySeverityAndReview(findings);
    for (const { severity, needsReview, findings: group } of grouped) {
      const tags = collectJurisdictionTags(group);
      const rule = resolvePolicy(input.policy, {
        severity,
        classification: cls,
        needsReview,
        ...(input.path !== undefined ? { path: input.path } : {}),
        jurisdictionTags: tags,
      });
      reasons.push({
        severity,
        classification: cls,
        count: group.length,
        action: rule.action,
        applied_rule: {
          source: rule.source,
          reference: rule.reference,
        },
        sample_finding_ids: group.slice(0, 5).map((f) => f.fingerprint),
        ...(needsReview ? { needsReview: true } : {}),
      });
    }
  }

  // Result aggregation: any `fail` → fail; else any `warn` → warn; else pass.
  let result: GateDecision['result'] = 'pass';
  for (const r of reasons) {
    if (r.action === 'fail') {
      result = 'fail';
      break;
    }
    if (r.action === 'warn') result = 'warn';
  }

  const newFailCount = reasons
    .filter((r) => r.classification === 'new' && r.action === 'fail')
    .reduce((acc, r) => acc + r.count, 0);
  const recommendedAction =
    result === 'fail'
      ? `Fix ${newFailCount} new finding${newFailCount === 1 ? '' : 's'} before merge`
      : result === 'warn'
        ? 'Review warnings before merge (non-blocking)'
        : 'Gate passed — no blocking findings';

  const policyVersionHash = sha256Hex(canonicalize(input.policy));

  const decision: GateDecision = {
    decision_id: input.decisionId,
    decision_version: GATE_DECISION_VERSION,
    decided_at: input.decidedAt,
    diff_id: input.diff.diff_id,
    policy_version_hash: policyVersionHash,
    result,
    reasons,
    counts: input.diff.counts,
    exemptions_applied: input.exemptionsApplied ?? [],
    exemptions_invalidated: input.exemptionsInvalidated ?? [],
    recommended_action: recommendedAction,
    ...(input.reportUrl !== undefined ? { report_url: input.reportUrl } : {}),
    ...(input.haesAnchorIntent !== undefined
      ? { haes_anchor_intent: input.haesAnchorIntent }
      : {}),
  };

  return decision;
}

interface SeverityReviewGroup {
  severity: Severity;
  needsReview: boolean;
  findings: FindingWithFingerprint[];
}

/**
 * Group findings by (severity, needsReview). Splitting on needsReview
 * alongside severity keeps definite violations and needs-manual-review
 * candidates in separate groups even when they share a severity, so each
 * gets its own policy resolution and gate-profile-aware action.
 */
function groupBySeverityAndReview(
  findings: readonly FindingWithFingerprint[],
): SeverityReviewGroup[] {
  const groups = new Map<string, SeverityReviewGroup>();
  for (const f of findings) {
    const needsReview = f.needsReview === true;
    const key = `${f.severity}::${String(needsReview)}`;
    const existing = groups.get(key);
    if (existing) {
      existing.findings.push(f);
    } else {
      groups.set(key, { severity: f.severity, needsReview, findings: [f] });
    }
  }
  return [...groups.values()];
}

function collectJurisdictionTags(
  findings: readonly FindingWithFingerprint[],
): string[] {
  const tags = new Set<string>();
  for (const f of findings) {
    for (const t of f.jurisdictionTags) tags.add(t);
  }
  return [...tags];
}

/**
 * Lightweight validation of GateDecision shape.
 */
export function validateGateDecision(input: unknown): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  if (typeof input !== 'object' || input === null) {
    return { valid: false, errors: ['root: expected object'] };
  }
  const o = input as Record<string, unknown>;
  if (typeof o['decision_id'] !== 'string') {
    errors.push('decision_id: expected string');
  }
  if (typeof o['decision_version'] !== 'string') {
    errors.push('decision_version: expected string');
  }
  if (typeof o['decided_at'] !== 'string') {
    errors.push('decided_at: expected string');
  }
  if (typeof o['diff_id'] !== 'string') {
    errors.push('diff_id: expected string');
  }
  if (typeof o['policy_version_hash'] !== 'string') {
    errors.push('policy_version_hash: expected string');
  }
  if (o['result'] !== 'pass' && o['result'] !== 'fail' && o['result'] !== 'warn') {
    errors.push("result: expected 'pass' | 'fail' | 'warn'");
  }
  if (!Array.isArray(o['reasons'])) {
    errors.push('reasons: expected array');
  }
  return { valid: errors.length === 0, errors };
}

/**
 * Compute the SHA-256 of the canonical JSON of a GateDecision for replay
 * verification + HAES anchor pre-image.
 */
export function gateDecisionHash(decision: GateDecision): string {
  return sha256Hex(canonicalize(decision));
}
