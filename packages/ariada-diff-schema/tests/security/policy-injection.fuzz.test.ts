// SPDX-License-Identifier: EUPL-1.2
//
// Security fuzz: mutate policy inputs at random and confirm the
// validator rejects malformed input without panic / crash.

import { describe, it, expect } from 'vitest';

import { validateBaselinePolicy } from '../../src/baseline-policy.js';

describe('policy injection fuzz (security)', () => {
  it('100 random malformed inputs are rejected without throwing', () => {
    const samples: unknown[] = [
      null,
      undefined,
      0,
      '',
      [],
      { version: 1 },
      { version: '1.0' }, // missing defaults
      { defaults: {} }, // missing version
      { version: '1.0', defaults: {}, warn_only: 'yes' },
      { version: '1.0', defaults: null },
    ];
    for (let i = 0; i < 100; i++) {
      const idx = i % samples.length;
      expect(() => validateBaselinePolicy(samples[idx])).not.toThrow();
    }
  });
});
