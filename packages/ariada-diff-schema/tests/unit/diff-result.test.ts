// SPDX-License-Identifier: EUPL-1.2
import { describe, it, expect } from 'vitest';

import {
  CLASSIFICATIONS,
  DIFF_SCHEMA_VERSION,
  SEVERITIES,
  computeCounts,
  validateDiffResult,
  type DiffResult,
  type FindingWithFingerprint,
} from '../../src/diff-result.js';

function mkFinding(fp: string, ruleId = 'wcag2/1.1.1'): FindingWithFingerprint {
  return {
    ruleId,
    jurisdictionTags: ['WCAG2.2-AA'],
    severity: 'serious',
    selector: 'img',
    fingerprint: fp,
  };
}

describe('DiffResult constants', () => {
  it('exposes schema version', () => {
    expect(DIFF_SCHEMA_VERSION).toBe('1.0.0');
  });

  it('exposes classification set', () => {
    expect(CLASSIFICATIONS.has('new')).toBe(true);
    expect(CLASSIFICATIONS.has('pre_existing')).toBe(true);
    expect(CLASSIFICATIONS.has('resolved')).toBe(true);
    expect(CLASSIFICATIONS.has('near_duplicate')).toBe(true);
  });

  it('exposes severity set', () => {
    expect(SEVERITIES.has('critical')).toBe(true);
    expect(SEVERITIES.has('minor')).toBe(true);
  });
});

describe('computeCounts', () => {
  it('aggregates classification buckets', () => {
    const fp1 = 'a'.repeat(64);
    const fp2 = 'b'.repeat(64);
    const counts = computeCounts({
      new: [mkFinding(fp1)],
      pre_existing: [mkFinding(fp2)],
      resolved: [],
    });
    expect(counts.new).toBe(1);
    expect(counts.pre_existing).toBe(1);
    expect(counts.resolved).toBe(0);
    expect(counts.near_duplicate).toBe(0);
    expect(counts.total_head).toBe(2);
    expect(counts.total_base).toBe(1);
  });
});

describe('validateDiffResult', () => {
  function mkValidResult(): DiffResult {
    return {
      diff_id: '01HVABCDEF123456789ABCDEFG',
      diff_version: '1.0.0',
      computed_at: '2026-05-20T10:00:00Z',
      head: { scan_id: 'scan-h', scan_root_hash: 'a'.repeat(64) },
      base: { scan_id: 'scan-b', scan_root_hash: 'b'.repeat(64) },
      classification: {
        new: [mkFinding('c'.repeat(64))],
        pre_existing: [],
        resolved: [],
      },
      counts: {
        new: 1,
        pre_existing: 0,
        resolved: 0,
        near_duplicate: 0,
        total_head: 1,
        total_base: 0,
      },
      engine_info: {
        classifier: 'stub',
        classifier_version: '0.1.0',
        fingerprint_options: {},
      },
    };
  }

  it('accepts a valid DiffResult', () => {
    const r = validateDiffResult(mkValidResult());
    expect(r.valid).toBe(true);
    expect(r.errors).toEqual([]);
  });

  it('rejects non-object input', () => {
    expect(validateDiffResult(null).valid).toBe(false);
    expect(validateDiffResult('string').valid).toBe(false);
  });

  it('rejects missing diff_id', () => {
    const bad = { ...mkValidResult(), diff_id: '' };
    const r = validateDiffResult(bad);
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes('diff_id'))).toBe(true);
  });

  it('rejects invalid severity', () => {
    const bad = mkValidResult();
    const f = bad.classification.new[0];
    if (f) {
       
      (f as any).severity = 'catastrophic';
    }
    const r = validateDiffResult(bad);
    expect(r.valid).toBe(false);
  });

  it('rejects non-hex fingerprint', () => {
    const bad = mkValidResult();
    const f = bad.classification.new[0];
    if (f) f.fingerprint = 'zzz';
    const r = validateDiffResult(bad);
    expect(r.valid).toBe(false);
  });

  it('rejects unknown classifier', () => {
    const bad = mkValidResult();
     
    (bad.engine_info as any).classifier = 'oracle';
    const r = validateDiffResult(bad);
    expect(r.valid).toBe(false);
  });
});
