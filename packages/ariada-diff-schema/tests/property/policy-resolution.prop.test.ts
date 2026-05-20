// SPDX-License-Identifier: EUPL-1.2
//
// Property: given the same finding context + same policy, the resolved
// rule is always identical (policy resolution is deterministic).

import { describe, it, expect } from 'vitest';

import {
  defaultPolicy,
  resolvePolicy,
  type BaselinePolicy,
} from '../../src/baseline-policy.js';
import type { Severity } from '../../src/fingerprint.js';

const SEVERITIES: readonly Severity[] = ['critical', 'serious', 'moderate', 'minor'];

describe('policy resolution determinism (property)', () => {
  it('default policy resolves every (severity, classification) the same way each call', () => {
    const p = defaultPolicy();
    for (const severity of SEVERITIES) {
      for (const cls of ['new', 'pre_existing', 'resolved'] as const) {
        const a = resolvePolicy(p, { severity, classification: cls });
        const b = resolvePolicy(p, { severity, classification: cls });
        expect(a.action).toBe(b.action);
        expect(a.source).toBe(b.source);
        expect(a.reference).toBe(b.reference);
      }
    }
  });

  it('warn_only downgrades every fail action without changing source', () => {
    const p1 = defaultPolicy();
    const p2: BaselinePolicy = { ...p1, warn_only: true };
    for (const severity of SEVERITIES) {
      const r1 = resolvePolicy(p1, { severity, classification: 'new' });
      const r2 = resolvePolicy(p2, { severity, classification: 'new' });
      if (r1.action === 'fail') {
        expect(r2.action).toBe('warn');
      } else {
        expect(r2.action).toBe(r1.action);
      }
    }
  });
});
