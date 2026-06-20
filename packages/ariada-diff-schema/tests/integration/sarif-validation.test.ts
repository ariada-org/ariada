// SPDX-License-Identifier: EUPL-1.2
import { describe, it, expect } from 'vitest';

import {
  computeCounts,
  type DiffResult,
  type FindingWithFingerprint,
} from '../../src/diff-result.js';
import { emitSarif } from '../../src/sarif.js';

describe('SARIF emission shape (integration)', () => {
  it('emits a SARIF document with the expected top-level keys', () => {
    const f: FindingWithFingerprint = {
      ruleId: 'wcag2/1.1.1',
      wcagSc: '1.1.1',
      jurisdictionTags: ['WCAG2.2-AA'],
      severity: 'serious',
      selector: 'img.hero',
      fingerprint: 'a'.repeat(64),
    };
    const classification = { new: [f], pre_existing: [], resolved: [] };
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
    const sarif = emitSarif(diff);
    const keys = Object.keys(sarif).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    expect(keys).toEqual(['$schema', 'runs', 'version']);
    expect(sarif.runs[0]?.tool.driver.rules?.length).toBeGreaterThanOrEqual(1);
  });
});
