// SPDX-License-Identifier: EUPL-1.2
//
// Property: any DiffResult conforming to schema 1.0 round-trips through
// JSON serialisation + parsing + validation.

import { describe, it, expect } from 'vitest';

import { defaultPolicy } from '../../src/baseline-policy.js';
import {
  computeCounts,
  validateDiffResult,
  type DiffResult,
  type FindingWithFingerprint,
} from '../../src/diff-result.js';
import {
  buildGateDecision,
  gateDecisionHash,
  validateGateDecision,
} from '../../src/gate-decision.js';

function mkFinding(seed: number): FindingWithFingerprint {
  const fp = seed.toString(16).padStart(64, '0');
  return {
    ruleId: `wcag2/r${seed % 9}`,
    jurisdictionTags: ['WCAG2.2-AA'],
    severity: 'serious',
    selector: `div.s${seed % 10}`,
    fingerprint: fp,
  };
}

describe('schema round-trip (property)', () => {
  it('100 random DiffResults survive JSON.stringify → JSON.parse → validate', () => {
    for (let i = 0; i < 100; i++) {
      const findings: FindingWithFingerprint[] = [];
      for (let k = 0; k < (i % 7); k++) findings.push(mkFinding(i * 13 + k));
      const classification = {
        new: findings,
        pre_existing: [],
        resolved: [],
      };
      const diff: DiffResult = {
        diff_id: `01HVABCDEF${i.toString().padStart(16, '0')}`,
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
      const json = JSON.stringify(diff);
      const parsed: unknown = JSON.parse(json);
      const r = validateDiffResult(parsed);
      expect(r.valid).toBe(true);
    }
  });

  it('GateDecision hashes are stable across JSON round-trip', () => {
    const classification = {
      new: [mkFinding(1), mkFinding(2)],
      pre_existing: [],
      resolved: [],
    };
    const diff: DiffResult = {
      diff_id: '01HVABCDEF',
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
    const decision = buildGateDecision({
      diff,
      policy: defaultPolicy(),
      decisionId: '01HVDECISION',
      decidedAt: '2026-05-20T10:01:00Z',
    });
    const hashA = gateDecisionHash(decision);
    const parsed = JSON.parse(JSON.stringify(decision));
    expect(validateGateDecision(parsed).valid).toBe(true);
    const hashB = gateDecisionHash(parsed);
    expect(hashA).toBe(hashB);
  });
});
