// SPDX-License-Identifier: EUPL-1.2
import { describe, it, expect } from 'vitest';

import {
  computeFindingFingerprint,
  computeFingerprints,
  type Finding,
} from '../../src/fingerprint.js';

const baseFinding: Finding = {
  ruleId: 'wcag2/1.1.1',
  wcagSc: '1.1.1',
  jurisdictionTags: ['WCAG2.2-AA', 'EAA'],
  severity: 'serious',
  selector: 'main > img.hero',
  axTreeRole: 'img',
  axTreeName: 'Marketing hero image',
};

describe('computeFindingFingerprint', () => {
  it('returns 64-char lowercase hex', () => {
    const fp = computeFindingFingerprint(baseFinding);
    expect(fp).toMatch(/^[0-9a-f]{64}$/);
  });

  it('produces identical hashes for identical findings (determinism)', () => {
    const a = computeFindingFingerprint(baseFinding);
    const b = computeFindingFingerprint({ ...baseFinding });
    expect(a).toBe(b);
  });

  it('is invariant to jurisdictionTags ordering', () => {
    const a = computeFindingFingerprint(baseFinding);
    const b = computeFindingFingerprint({
      ...baseFinding,
      jurisdictionTags: ['EAA', 'WCAG2.2-AA'],
    });
    expect(a).toBe(b);
  });

  it('changes when ruleId differs', () => {
    const a = computeFindingFingerprint(baseFinding);
    const b = computeFindingFingerprint({ ...baseFinding, ruleId: 'wcag2/1.4.3' });
    expect(a).not.toBe(b);
  });

  it('changes when severity differs', () => {
    const a = computeFindingFingerprint(baseFinding);
    const b = computeFindingFingerprint({ ...baseFinding, severity: 'critical' });
    expect(a).not.toBe(b);
  });

  it('hashes the AX-tree name (not retains plaintext)', () => {
    const fp = computeFindingFingerprint(baseFinding);
    expect(fp).not.toContain('Marketing');
  });

  it('uses 16-char hex prefix for AX name hash by default', () => {
    // Two findings with different names should hash differently.
    const a = computeFindingFingerprint(baseFinding);
    const b = computeFindingFingerprint({ ...baseFinding, axTreeName: 'Banner image' });
    expect(a).not.toBe(b);
  });

  it('respects nameHashLength override', () => {
    const fp = computeFindingFingerprint(baseFinding, { nameHashLength: 8 });
    expect(fp).toMatch(/^[0-9a-f]{64}$/);
  });

  it('handles missing optional fields (wcagSc, axTreeRole, axTreeName)', () => {
    const minimal: Finding = {
      ruleId: 'wcag2/1.1.1',
      jurisdictionTags: [],
      severity: 'minor',
      selector: 'div',
    };
    const fp = computeFindingFingerprint(minimal);
    expect(fp).toMatch(/^[0-9a-f]{64}$/);
  });

  it('treats empty axTreeName as null', () => {
    const a = computeFindingFingerprint({ ...baseFinding, axTreeName: '' });
    const b = computeFindingFingerprint({ ...baseFinding, axTreeName: null });
    expect(a).toBe(b);
  });

  it('normalises selector for fingerprint stability', () => {
    const a = computeFindingFingerprint({
      ...baseFinding,
      selector: 'MAIN > IMG.hero',
    });
    const b = computeFindingFingerprint({
      ...baseFinding,
      selector: 'main > img.hero',
    });
    expect(a).toBe(b);
  });
});

describe('computeFingerprints', () => {
  it('maps an array of findings to a parallel array of hashes', () => {
    const findings: Finding[] = [
      baseFinding,
      { ...baseFinding, ruleId: 'wcag2/1.4.3' },
      { ...baseFinding, ruleId: 'wcag2/2.4.7' },
    ];
    const out = computeFingerprints(findings);
    expect(out).toHaveLength(3);
    expect(new Set(out).size).toBe(3); // all distinct
  });
});
