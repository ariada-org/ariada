// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

import { describe, expect, it } from 'vitest';

import { runListRules } from '../src/tools/list-rules.js';

describe('runListRules', () => {
  it('returns the full catalogue by default', () => {
    const out = runListRules({});
    expect(out.length).toBeGreaterThan(0);
    for (const r of out) {
      expect(typeof r.id).toBe('string');
      expect(Array.isArray(r.wcagSuccessCriteria)).toBe(true);
      expect(Array.isArray(r.en301549Clauses)).toBe(true);
    }
  });

  it('filters by pack', () => {
    const all = runListRules({});
    const checkout = runListRules({ pack: 'checkout' });
    expect(checkout.length).toBeGreaterThan(0);
    expect(checkout.length).toBeLessThanOrEqual(all.length);
    for (const r of checkout) {
      expect(r.pack).toBe('checkout');
    }
  });

  it('filters by wcagOnly', () => {
    const out = runListRules({ wcagOnly: true });
    for (const r of out) {
      expect(r.wcagSuccessCriteria.length).toBeGreaterThan(0);
    }
  });

  it('filters by en301549Only', () => {
    const out = runListRules({ en301549Only: true });
    for (const r of out) {
      expect(r.en301549Clauses.length).toBeGreaterThan(0);
    }
  });

  it('returns identical results across two calls (deterministic)', () => {
    const a = runListRules({});
    const b = runListRules({});
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
