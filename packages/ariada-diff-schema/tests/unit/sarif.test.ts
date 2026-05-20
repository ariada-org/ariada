// SPDX-License-Identifier: EUPL-1.2
import { describe, it, expect } from 'vitest';

import {
  computeCounts,
  type DiffResult,
  type FindingWithFingerprint,
} from '../../src/diff-result.js';
import { emitSarif, validateSarifShape } from '../../src/sarif.js';

function mkFinding(
  fp: string,
  severity: FindingWithFingerprint['severity'],
): FindingWithFingerprint {
  return {
    ruleId: 'wcag2/1.1.1',
    wcagSc: '1.1.1',
    jurisdictionTags: ['WCAG2.2-AA'],
    severity,
    selector: 'main > img.hero',
    fingerprint: fp,
  };
}

function mkDiff(newFindings: FindingWithFingerprint[]): DiffResult {
  const classification = {
    new: newFindings,
    pre_existing: [],
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

describe('emitSarif', () => {
  it('emits SARIF 2.1.0 with $schema + version', () => {
    const sarif = emitSarif(mkDiff([mkFinding('a'.repeat(64), 'serious')]));
    expect(sarif.version).toBe('2.1.0');
    expect(sarif.$schema).toContain('sarif-schema-2.1.0');
  });

  it('emits one result per new finding', () => {
    const sarif = emitSarif(
      mkDiff([
        mkFinding('a'.repeat(64), 'critical'),
        mkFinding('b'.repeat(64), 'minor'),
      ]),
    );
    expect(sarif.runs[0]?.results).toHaveLength(2);
  });

  it('maps severity to SARIF level', () => {
    const sarif = emitSarif(
      mkDiff([
        mkFinding('a'.repeat(64), 'critical'),
        mkFinding('b'.repeat(64), 'serious'),
        mkFinding('c'.repeat(64), 'moderate'),
        mkFinding('d'.repeat(64), 'minor'),
      ]),
    );
    const levels = sarif.runs[0]?.results.map((r) => r.level) ?? [];
    expect(levels).toEqual(['error', 'error', 'warning', 'note']);
  });

  it('includes the finding fingerprint', () => {
    const sarif = emitSarif(mkDiff([mkFinding('f'.repeat(64), 'serious')]));
    expect(sarif.runs[0]?.results[0]?.fingerprints['ariada/diff/v1']).toBe(
      'f'.repeat(64),
    );
  });

  it('sets tool driver to ariada-diff', () => {
    const sarif = emitSarif(mkDiff([mkFinding('a'.repeat(64), 'serious')]));
    expect(sarif.runs[0]?.tool.driver.name).toBe('ariada-diff');
    expect(sarif.runs[0]?.tool.driver.informationUri).toBe('https://ariada.org/');
  });

  it('emits empty results array for diffs with no new findings', () => {
    const sarif = emitSarif(mkDiff([]));
    expect(sarif.runs[0]?.results).toEqual([]);
  });
});

describe('validateSarifShape', () => {
  it('accepts emitter output', () => {
    const sarif = emitSarif(mkDiff([mkFinding('a'.repeat(64), 'serious')]));
    const r = validateSarifShape(sarif);
    expect(r.valid).toBe(true);
  });

  it('rejects wrong version', () => {
    const r = validateSarifShape({ version: '1.0.0', runs: [], $schema: 'x' });
    expect(r.valid).toBe(false);
  });

  it('rejects null', () => {
    expect(validateSarifShape(null).valid).toBe(false);
  });
});
