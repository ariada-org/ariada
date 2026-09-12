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
  // An explicit budget, because the default five seconds is not a statement
  // about this test — it is a default. Under coverage instrumentation the run
  // crossed it and the suite reported a collision failure that had not
  // happened, which then travelled onward as "this package cannot report
  // coverage". A test about collisions must not be decided by a clock.
  it('5000 distinct findings produce 5000 distinct fingerprints', () => {
    const seen = new Map<string, string>();
    let stolknovenie: string | undefined;

    for (let i = 0; i < 5000; i++) {
      const f: Finding = {
        ruleId: `wcag2/r${i % 50}`,
        jurisdictionTags: ['WCAG2.2-AA'],
        severity: 'serious',
        selector: `div.col-${i}`,
      };
      const fp = computeFindingFingerprint(f);
      // Recorded rather than asserted inside the loop. Five thousand assertions
      // are most of this test's cost, and the first one to fail says only that
      // something collided; keeping the earlier finding lets the failure name
      // both sides of the collision, which is what anyone reading it needs.
      const ranee = seen.get(fp);
      if (ranee !== undefined && stolknovenie === undefined) {
        stolknovenie = `${fp} produced by both ${ranee} and ${f.selector}`;
      }
      seen.set(fp, f.selector);
    }

    expect(stolknovenie).toBeUndefined();
    expect(seen.size).toBe(5000);
  }, 30_000);
});
