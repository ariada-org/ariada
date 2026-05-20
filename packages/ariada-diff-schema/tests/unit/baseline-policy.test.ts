// SPDX-License-Identifier: EUPL-1.2
import { describe, it, expect } from 'vitest';

import {
  defaultPolicy,
  resolvePolicy,
  validateBaselinePolicy,
  type BaselinePolicy,
} from '../../src/baseline-policy.js';

describe('defaultPolicy', () => {
  it('returns a policy with sensible defaults', () => {
    const p = defaultPolicy();
    expect(p.version).toBe('1.0');
    expect(p.warn_only).toBe(false);
    expect(p.defaults.new?.critical?.action).toBe('fail');
    expect(p.defaults.new?.minor?.action).toBe('warn');
    expect(p.defaults.pre_existing?.critical?.action).toBe('warn');
    expect(p.defaults.resolved?.any?.action).toBe('info');
  });
});

describe('resolvePolicy', () => {
  it('resolves new critical to fail via defaults', () => {
    const p = defaultPolicy();
    const r = resolvePolicy(p, { severity: 'critical', classification: 'new' });
    expect(r.action).toBe('fail');
    expect(r.source).toBe('defaults');
  });

  it('resolves new moderate to warn via defaults', () => {
    const p = defaultPolicy();
    const r = resolvePolicy(p, { severity: 'moderate', classification: 'new' });
    expect(r.action).toBe('warn');
  });

  it('applies warn_only downgrade to all fail decisions', () => {
    const p: BaselinePolicy = { ...defaultPolicy(), warn_only: true };
    const r = resolvePolicy(p, { severity: 'critical', classification: 'new' });
    expect(r.action).toBe('warn');
  });

  it('respects path_overrides', () => {
    const p: BaselinePolicy = {
      ...defaultPolicy(),
      path_overrides: [
        {
          paths: ['apps/checkout/**'],
          new: { moderate: { action: 'fail' } },
        },
      ],
    };
    const r = resolvePolicy(p, {
      severity: 'moderate',
      classification: 'new',
      path: 'apps/checkout/index.html',
    });
    expect(r.action).toBe('fail');
    expect(r.source).toBe('path_overrides');
  });

  it('uses longest-glob-match for path overrides', () => {
    const p: BaselinePolicy = {
      ...defaultPolicy(),
      path_overrides: [
        {
          paths: ['apps/**'],
          new: { minor: { action: 'fail' } },
        },
        {
          paths: ['apps/checkout/**'],
          new: { minor: { action: 'info' } },
        },
      ],
    };
    const r = resolvePolicy(p, {
      severity: 'minor',
      classification: 'new',
      path: 'apps/checkout/index.html',
    });
    // Longest match wins → checkout-specific rule.
    expect(r.action).toBe('info');
    expect(r.reference).toBe('path_overrides[1]');
  });

  it('respects jurisdiction_overrides when no path matches', () => {
    const p: BaselinePolicy = {
      ...defaultPolicy(),
      jurisdiction_overrides: {
        EAA: { new: { serious: { action: 'fail' } } },
      },
    };
    const r = resolvePolicy(p, {
      severity: 'serious',
      classification: 'new',
      jurisdictionTags: ['EAA'],
    });
    expect(r.action).toBe('fail');
    expect(r.source).toBe('jurisdiction_overrides');
  });

  it('path overrides win over jurisdiction overrides (tie-break)', () => {
    const p: BaselinePolicy = {
      ...defaultPolicy(),
      path_overrides: [
        {
          paths: ['apps/checkout/**'],
          new: { serious: { action: 'info' } },
        },
      ],
      jurisdiction_overrides: {
        EAA: { new: { serious: { action: 'fail' } } },
      },
    };
    const r = resolvePolicy(p, {
      severity: 'serious',
      classification: 'new',
      path: 'apps/checkout/index.html',
      jurisdictionTags: ['EAA'],
    });
    expect(r.source).toBe('path_overrides');
    expect(r.action).toBe('info');
  });

  it('treats near_duplicate as pre_existing for gating', () => {
    const p = defaultPolicy();
    const r = resolvePolicy(p, {
      severity: 'critical',
      classification: 'near_duplicate',
    });
    expect(r.action).toBe('warn'); // pre_existing.critical → warn
  });

  it('falls back to implicit info when no rule matches', () => {
    const p: BaselinePolicy = {
      version: '1.0',
      defaults: {},
    };
    const r = resolvePolicy(p, { severity: 'minor', classification: 'new' });
    expect(r.action).toBe('info');
    expect(r.reference).toBe('defaults.implicit');
  });
});

describe('validateBaselinePolicy', () => {
  it('accepts default policy', () => {
    const r = validateBaselinePolicy(defaultPolicy());
    expect(r.valid).toBe(true);
  });

  it('rejects missing version', () => {
     
    const r = validateBaselinePolicy({ defaults: {} } as any);
    expect(r.valid).toBe(false);
  });

  it('rejects non-object input', () => {
    expect(validateBaselinePolicy(null).valid).toBe(false);
  });
});
