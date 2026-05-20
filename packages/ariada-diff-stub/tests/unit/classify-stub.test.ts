// SPDX-License-Identifier: EUPL-1.2
import type { Finding } from '@ariada/diff-schema';
import { describe, it, expect } from 'vitest';


import {
  STUB_CLASSIFIER_VERSION,
  STUB_NOT_CANONICAL_BANNER,
  classifyStub,
} from '../../src/classify-stub.js';

const HEAD_META = { scan_id: 'h', scan_root_hash: 'a'.repeat(64) };
const BASE_META = { scan_id: 'b', scan_root_hash: 'b'.repeat(64) };

function mkF(rule: string, sel: string): Finding {
  return {
    ruleId: rule,
    jurisdictionTags: ['WCAG2.2-AA'],
    severity: 'serious',
    selector: sel,
  };
}

describe('classifyStub', () => {
  it('classifier metadata is "stub"', () => {
    const diff = classifyStub({
      headFindings: [],
      baseFindings: [],
      diffId: '01HVABCDEF',
      computedAt: '2026-05-20T10:00:00Z',
      head: HEAD_META,
      base: BASE_META,
    });
    expect(diff.engine_info.classifier).toBe('stub');
    expect(diff.engine_info.classifier_version).toBe(STUB_CLASSIFIER_VERSION);
  });

  it('classifies identity diff as all pre_existing', () => {
    const f = mkF('wcag2/1.1.1', 'img.a');
    const diff = classifyStub({
      headFindings: [f],
      baseFindings: [f],
      diffId: '01HVABCDEF',
      computedAt: '2026-05-20T10:00:00Z',
      head: HEAD_META,
      base: BASE_META,
    });
    expect(diff.classification.new).toHaveLength(0);
    expect(diff.classification.pre_existing).toHaveLength(1);
    expect(diff.classification.resolved).toHaveLength(0);
  });

  it('classifies new findings correctly', () => {
    const diff = classifyStub({
      headFindings: [mkF('wcag2/1.1.1', 'img.a'), mkF('wcag2/1.4.3', 'p.b')],
      baseFindings: [],
      diffId: '01HVABCDEF',
      computedAt: '2026-05-20T10:00:00Z',
      head: HEAD_META,
      base: BASE_META,
    });
    expect(diff.classification.new).toHaveLength(2);
  });

  it('classifies resolved findings correctly', () => {
    const diff = classifyStub({
      headFindings: [],
      baseFindings: [mkF('wcag2/1.1.1', 'img.a'), mkF('wcag2/1.4.3', 'p.b')],
      diffId: '01HVABCDEF',
      computedAt: '2026-05-20T10:00:00Z',
      head: HEAD_META,
      base: BASE_META,
    });
    expect(diff.classification.resolved).toHaveLength(2);
    expect(diff.classification.new).toHaveLength(0);
  });

  it('handles mixed new + pre_existing + resolved', () => {
    const shared = mkF('wcag2/1.1.1', 'img.a');
    const diff = classifyStub({
      headFindings: [shared, mkF('wcag2/1.4.3', 'p.b')],
      baseFindings: [shared, mkF('wcag2/2.4.7', 'a.c')],
      diffId: '01HVABCDEF',
      computedAt: '2026-05-20T10:00:00Z',
      head: HEAD_META,
      base: BASE_META,
    });
    expect(diff.classification.new).toHaveLength(1);
    expect(diff.classification.pre_existing).toHaveLength(1);
    expect(diff.classification.resolved).toHaveLength(1);
  });

  it('never emits near_duplicate', () => {
    const diff = classifyStub({
      headFindings: [mkF('wcag2/1.1.1', 'img.a')],
      baseFindings: [mkF('wcag2/1.1.1', 'img.b')], // slightly different selector
      diffId: '01HVABCDEF',
      computedAt: '2026-05-20T10:00:00Z',
      head: HEAD_META,
      base: BASE_META,
    });
    expect(diff.classification.near_duplicate).toBeUndefined();
  });

  it('counts are consistent with classification arrays', () => {
    const diff = classifyStub({
      headFindings: [mkF('wcag2/1.1.1', 'img.a'), mkF('wcag2/1.4.3', 'p.b')],
      baseFindings: [mkF('wcag2/1.1.1', 'img.a'), mkF('wcag2/2.4.7', 'a.c')],
      diffId: '01HVABCDEF',
      computedAt: '2026-05-20T10:00:00Z',
      head: HEAD_META,
      base: BASE_META,
    });
    expect(diff.counts.new).toBe(diff.classification.new.length);
    expect(diff.counts.pre_existing).toBe(diff.classification.pre_existing.length);
    expect(diff.counts.resolved).toBe(diff.classification.resolved.length);
    expect(diff.counts.total_head).toBe(2);
    expect(diff.counts.total_base).toBe(2);
  });

  it('is deterministic across repeated runs', () => {
    const input = {
      headFindings: [mkF('wcag2/1.1.1', 'img.a')],
      baseFindings: [],
      diffId: '01HVABCDEF',
      computedAt: '2026-05-20T10:00:00Z',
      head: HEAD_META,
      base: BASE_META,
    };
    const a = classifyStub(input);
    const b = classifyStub(input);
    expect(a.classification.new[0]?.fingerprint).toBe(
      b.classification.new[0]?.fingerprint,
    );
  });

  it('exposes the «not canonical» banner', () => {
    expect(STUB_NOT_CANONICAL_BANNER.length).toBeGreaterThan(0);
    expect(STUB_NOT_CANONICAL_BANNER.toLowerCase()).toContain('not');
  });

  it('honours fingerprint options', () => {
    const f: Finding = {
      ruleId: 'wcag2/1.1.1',
      jurisdictionTags: ['WCAG2.2-AA'],
      severity: 'serious',
      selector: 'div#widget_abc123',
    };
    const diff = classifyStub({
      headFindings: [f],
      baseFindings: [],
      diffId: '01HVABCDEF',
      computedAt: '2026-05-20T10:00:00Z',
      head: HEAD_META,
      base: BASE_META,
      fingerprintOptions: { strictIdRegex: true },
    });
    expect(diff.engine_info.fingerprint_options.strictIdRegex).toBe(true);
  });
});
