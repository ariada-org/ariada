// SPDX-License-Identifier: EUPL-1.2
import { describe, it, expect } from 'vitest';

import { defaultPolicy } from '../../src/baseline-policy.js';
import { computeCounts, type DiffResult, type FindingWithFingerprint } from '../../src/diff-result.js';
import {
  GATE_DECISION_VERSION,
  buildGateDecision,
  gateDecisionHash,
  validateGateDecision,
} from '../../src/gate-decision.js';

function mkFinding(
  fp: string,
  severity: FindingWithFingerprint['severity'] = 'serious',
): FindingWithFingerprint {
  return {
    ruleId: 'wcag2/1.1.1',
    jurisdictionTags: ['WCAG2.2-AA'],
    severity,
    selector: 'img',
    fingerprint: fp,
  };
}

function mkDiff(
  newFindings: FindingWithFingerprint[],
  preExisting: FindingWithFingerprint[] = [],
): DiffResult {
  const classification = {
    new: newFindings,
    pre_existing: preExisting,
    resolved: [],
  };
  return {
    diff_id: '01HVABCDEF123456789ABCDEFG',
    diff_version: '1.0.0',
    computed_at: '2026-05-20T10:00:00Z',
    head: { scan_id: 'h', scan_root_hash: 'a'.repeat(64) },
    base: { scan_id: 'b', scan_root_hash: 'b'.repeat(64) },
    classification,
    counts: computeCounts(classification),
    engine_info: {
      classifier: 'stub',
      classifier_version: '0.1.0',
      fingerprint_options: {},
    },
  };
}

describe('buildGateDecision', () => {
  it('produces pass when no new findings', () => {
    const decision = buildGateDecision({
      diff: mkDiff([]),
      policy: defaultPolicy(),
      decisionId: '01HVDECISIONID00000000000',
      decidedAt: '2026-05-20T10:01:00Z',
    });
    expect(decision.result).toBe('pass');
    expect(decision.reasons).toEqual([]);
  });

  it('fails on new critical', () => {
    const decision = buildGateDecision({
      diff: mkDiff([mkFinding('a'.repeat(64), 'critical')]),
      policy: defaultPolicy(),
      decisionId: '01HVDECISIONID00000000000',
      decidedAt: '2026-05-20T10:01:00Z',
    });
    expect(decision.result).toBe('fail');
    expect(decision.reasons.some((r) => r.action === 'fail')).toBe(true);
  });

  it('warns on new moderate', () => {
    const decision = buildGateDecision({
      diff: mkDiff([mkFinding('a'.repeat(64), 'moderate')]),
      policy: defaultPolicy(),
      decisionId: '01HVDECISIONID00000000000',
      decidedAt: '2026-05-20T10:01:00Z',
    });
    expect(decision.result).toBe('warn');
  });

  it('aggregates reasons by (severity, classification)', () => {
    const decision = buildGateDecision({
      diff: mkDiff([
        mkFinding('a'.repeat(64), 'critical'),
        mkFinding('b'.repeat(64), 'critical'),
        mkFinding('c'.repeat(64), 'serious'),
      ]),
      policy: defaultPolicy(),
      decisionId: '01HVDECISIONID00000000000',
      decidedAt: '2026-05-20T10:01:00Z',
    });
    const criticalReason = decision.reasons.find(
      (r) => r.severity === 'critical' && r.classification === 'new',
    );
    expect(criticalReason?.count).toBe(2);
    expect(criticalReason?.sample_finding_ids.length).toBeLessThanOrEqual(5);
  });

  it('includes recommended_action prose', () => {
    const decision = buildGateDecision({
      diff: mkDiff([mkFinding('a'.repeat(64), 'critical')]),
      policy: defaultPolicy(),
      decisionId: '01HVDECISIONID00000000000',
      decidedAt: '2026-05-20T10:01:00Z',
    });
    expect(decision.recommended_action.length).toBeGreaterThan(0);
    expect(decision.recommended_action).toMatch(/Fix \d+/);
  });

  it('respects optional report_url + haes_anchor_intent', () => {
    const decision = buildGateDecision({
      diff: mkDiff([]),
      policy: defaultPolicy(),
      decisionId: '01HVDECISIONID00000000000',
      decidedAt: '2026-05-20T10:01:00Z',
      reportUrl: 'https://example.test/report',
      haesAnchorIntent: 'anchor',
    });
    expect(decision.report_url).toBe('https://example.test/report');
    expect(decision.haes_anchor_intent).toBe('anchor');
  });

  it('hashes the policy for policy_version_hash', () => {
    const decision = buildGateDecision({
      diff: mkDiff([]),
      policy: defaultPolicy(),
      decisionId: '01HVDECISIONID00000000000',
      decidedAt: '2026-05-20T10:01:00Z',
    });
    expect(decision.policy_version_hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is deterministic across runs (replay)', () => {
    const a = buildGateDecision({
      diff: mkDiff([mkFinding('a'.repeat(64), 'critical')]),
      policy: defaultPolicy(),
      decisionId: '01HVDECISIONID00000000000',
      decidedAt: '2026-05-20T10:01:00Z',
    });
    const b = buildGateDecision({
      diff: mkDiff([mkFinding('a'.repeat(64), 'critical')]),
      policy: defaultPolicy(),
      decisionId: '01HVDECISIONID00000000000',
      decidedAt: '2026-05-20T10:01:00Z',
    });
    expect(gateDecisionHash(a)).toBe(gateDecisionHash(b));
  });

  it('exposes GATE_DECISION_VERSION', () => {
    expect(GATE_DECISION_VERSION).toBe('1.0.0');
  });
});

describe('validateGateDecision', () => {
  it('accepts a valid decision', () => {
    const decision = buildGateDecision({
      diff: mkDiff([]),
      policy: defaultPolicy(),
      decisionId: '01HVDECISIONID00000000000',
      decidedAt: '2026-05-20T10:01:00Z',
    });
    const r = validateGateDecision(decision);
    expect(r.valid).toBe(true);
  });

  it('rejects malformed decision', () => {
     
    const r = validateGateDecision({ result: 'oops' } as any);
    expect(r.valid).toBe(false);
  });
});
