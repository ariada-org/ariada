// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

import { describe, expect, it } from 'vitest';

import { canonicalRuleId, runExplainViolation } from '../src/tools/explain-violation.js';
import { runListRules } from '../src/tools/list-rules.js';

describe('canonicalRuleId', () => {
  it('returns the input unchanged when no hash fragment', () => {
    expect(canonicalRuleId('ariada/checkout/payment-fieldset-grouping')).toBe(
      'ariada/checkout/payment-fieldset-grouping',
    );
  });

  it('strips the hash fragment when present', () => {
    expect(canonicalRuleId('ariada/checkout/payment-fieldset-grouping#form-order')).toBe(
      'ariada/checkout/payment-fieldset-grouping',
    );
  });
});

describe('runExplainViolation', () => {
  it('returns status known for an existing rule id', () => {
    const all = runListRules({});
    const first = all[0];
    if (!first) throw new Error('catalogue empty — fixture missing');
    const out = runExplainViolation({ violationId: first.id });
    expect(out.status).toBe('known');
    if (out.status === 'known') {
      expect(out.violationId).toBe(first.id);
      expect(typeof out.summary).toBe('string');
    }
  });

  it('returns status unknown-violation for a missing rule id', () => {
    const out = runExplainViolation({ violationId: 'definitely-not-a-real-rule-id' });
    expect(out.status).toBe('unknown-violation');
    if (out.status === 'unknown-violation') {
      expect(out.violationId).toBe('definitely-not-a-real-rule-id');
    }
  });

  it('treats fully-qualified finding IDs the same as bare rule IDs', () => {
    const all = runListRules({});
    const first = all[0];
    if (!first) throw new Error('catalogue empty — fixture missing');
    const out = runExplainViolation({ violationId: `${first.id}#some-target` });
    expect(out.status).toBe('known');
  });

  it('never fabricates text for unknown IDs', () => {
    const out = runExplainViolation({ violationId: 'unknown.id.42' });
    expect(out.status).toBe('unknown-violation');
    expect('summary' in out).toBe(false);
  });
});
