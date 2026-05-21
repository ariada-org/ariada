// SPDX-License-Identifier: EUPL-1.2
//
// Integration: confirm the stub's DiffResult shape matches what the
// canonical engine produces (minus the `near_duplicate` field). The
// shape contract is what makes downstream consumers swappable between
// the two engines.

import { validateDiffResult, type Finding } from '@ariada-org/diff-schema';
import { describe, it, expect } from 'vitest';


import { classifyStub } from '../../src/classify-stub.js';

describe('stub DiffResult shape parity', () => {
  it('passes the canonical DiffResult validator', () => {
    const f: Finding = {
      ruleId: 'wcag2/1.1.1',
      jurisdictionTags: ['WCAG2.2-AA'],
      severity: 'serious',
      selector: 'main',
    };
    const diff = classifyStub({
      headFindings: [f],
      baseFindings: [],
      diffId: '01HVABCDEF',
      computedAt: '2026-05-20T10:00:00Z',
      head: { scan_id: 'h', scan_root_hash: 'a'.repeat(64) },
      base: { scan_id: 'b', scan_root_hash: 'b'.repeat(64) },
    });
    const r = validateDiffResult(diff);
    expect(r.valid).toBe(true);
    expect(r.errors).toEqual([]);
  });

  it('does not introduce extra top-level keys', () => {
    const diff = classifyStub({
      headFindings: [],
      baseFindings: [],
      diffId: '01HVABCDEF',
      computedAt: '2026-05-20T10:00:00Z',
      head: { scan_id: 'h', scan_root_hash: 'a'.repeat(64) },
      base: { scan_id: 'b', scan_root_hash: 'b'.repeat(64) },
    });
    const keys = Object.keys(diff).sort();
    expect(keys).toEqual([
      'base',
      'classification',
      'computed_at',
      'counts',
      'diff_id',
      'diff_version',
      'engine_info',
      'head',
    ]);
  });
});
