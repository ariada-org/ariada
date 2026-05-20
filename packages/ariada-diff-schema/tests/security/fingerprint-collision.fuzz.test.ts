// SPDX-License-Identifier: EUPL-1.2
//
// Security fuzz: synthesise N pseudo-random findings and confirm no
// fingerprint collisions occur. SHA-256 collision space is far below
// any reasonable test size — this is a canary against algorithmic
// regressions (e.g. accidental truncation, hash-input projection bugs).

import { describe, it, expect } from 'vitest';

import {
  computeFindingFingerprint,
  type Finding,
} from '../../src/fingerprint.js';

describe('fingerprint collision canary (security)', () => {
  it('5000 distinct findings produce 5000 distinct fingerprints', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 5000; i++) {
      const f: Finding = {
        ruleId: `wcag2/r${i % 50}`,
        jurisdictionTags: ['WCAG2.2-AA'],
        severity: 'serious',
        selector: `div.col-${i}`,
      };
      const fp = computeFindingFingerprint(f);
      expect(seen.has(fp)).toBe(false);
      seen.add(fp);
    }
    expect(seen.size).toBe(5000);
  });
});
