// SPDX-License-Identifier: EUPL-1.2
//
// Integration: running the same diff classify + gate pipeline twice
// produces byte-identical output (sans the externally-provided ULIDs).

import { describe, it, expect } from 'vitest';

import {
  defaultPolicy,
} from '../../src/baseline-policy.js';
import {
  computeCounts,
  type DiffResult,
  type FindingWithFingerprint,
} from '../../src/diff-result.js';
import {
  computeFindingFingerprint,
  type Finding,
} from '../../src/fingerprint.js';
import {
  buildGateDecision,
  gateDecisionHash,
} from '../../src/gate-decision.js';
import { canonicalize } from '../../src/internal/jcs-encode.js';

function classify(head: Finding[], base: Finding[]): DiffResult {
  const headWithFp = head.map((f) => ({
    ...f,
    fingerprint: computeFindingFingerprint(f),
  })) as FindingWithFingerprint[];
  const baseWithFp = base.map((f) => ({
    ...f,
    fingerprint: computeFindingFingerprint(f),
  })) as FindingWithFingerprint[];
  const baseSet = new Set(baseWithFp.map((f) => f.fingerprint));
  const newF: FindingWithFingerprint[] = [];
  const preEx: FindingWithFingerprint[] = [];
  for (const f of headWithFp) {
    if (baseSet.has(f.fingerprint)) preEx.push(f);
    else newF.push(f);
  }
  const headSet = new Set(headWithFp.map((f) => f.fingerprint));
  const resolved = baseWithFp.filter((f) => !headSet.has(f.fingerprint));
  const classification = { new: newF, pre_existing: preEx, resolved };
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

const mkF = (rule: string, sel: string, sev: Finding['severity'] = 'serious'): Finding => ({
  ruleId: rule,
  jurisdictionTags: ['WCAG2.2-AA'],
  severity: sev,
  selector: sel,
});

describe('replay determinism (integration)', () => {
  it('identity diff (head === base) produces zero new/resolved', () => {
    const head = [mkF('wcag2/1.1.1', 'img.hero')];
    const base = [mkF('wcag2/1.1.1', 'img.hero')];
    const diff = classify(head, base);
    expect(diff.classification.new).toHaveLength(0);
    expect(diff.classification.resolved).toHaveLength(0);
    expect(diff.classification.pre_existing).toHaveLength(1);
  });

  it('add-3 diff (3 new, 0 resolved)', () => {
    const head = [
      mkF('wcag2/1.1.1', 'img.a'),
      mkF('wcag2/1.4.3', 'p.b'),
      mkF('wcag2/2.4.7', 'a.c'),
    ];
    const diff = classify(head, []);
    expect(diff.classification.new).toHaveLength(3);
    expect(diff.classification.resolved).toHaveLength(0);
  });

  it('remove-3 diff (0 new, 3 resolved)', () => {
    const base = [
      mkF('wcag2/1.1.1', 'img.a'),
      mkF('wcag2/1.4.3', 'p.b'),
      mkF('wcag2/2.4.7', 'a.c'),
    ];
    const diff = classify([], base);
    expect(diff.classification.new).toHaveLength(0);
    expect(diff.classification.resolved).toHaveLength(3);
  });

  it('replay gates byte-identically for the same inputs', () => {
    const head = [mkF('wcag2/1.1.1', 'img.a', 'critical')];
    const base: Finding[] = [];
    const diff = classify(head, base);
    const policy = defaultPolicy();
    const a = buildGateDecision({
      diff,
      policy,
      decisionId: '01HVD',
      decidedAt: '2026-05-20T10:01:00Z',
    });
    const b = buildGateDecision({
      diff,
      policy,
      decisionId: '01HVD',
      decidedAt: '2026-05-20T10:01:00Z',
    });
    expect(canonicalize(a)).toBe(canonicalize(b));
    expect(gateDecisionHash(a)).toBe(gateDecisionHash(b));
  });
});
