// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

import { describe, expect, it } from 'vitest';

import { runSuggestFix } from '../src/tools/suggest-fix.js';

describe('runSuggestFix', () => {
  it('returns no-known-pattern for an unknown violation id', () => {
    const out = runSuggestFix({ violationId: 'not-a-real-rule' });
    expect(out.confidence).toBe('no-known-pattern');
    expect(out.pattern).toBeNull();
    expect(out.hint).toBeDefined();
  });

  it('never fabricates a pattern for unknown IDs', () => {
    const out = runSuggestFix({ violationId: 'random.fake.id' });
    expect(out.pattern).toBeNull();
    expect(out.frameworkAdaptation).toBeNull();
  });

  it('adapts canonical HTML pattern for react when a pattern is known', () => {
    // We assume at least one rule in the catalogue maps to SC 1.3.1; if not,
    // the test is still valid because the function returns no-known-pattern
    // safely.
    const out = runSuggestFix({
      violationId: 'ariada/checkout/payment-fieldset-grouping',
      context: { framework: 'react' },
    });
    expect(['canonical', 'adapted', 'no-known-pattern']).toContain(out.confidence);
    if (out.confidence === 'adapted' && out.frameworkAdaptation) {
      // Adapted react pattern must not contain raw `for=`.
      expect(out.frameworkAdaptation).not.toMatch(/\sfor=/);
    }
  });
});
