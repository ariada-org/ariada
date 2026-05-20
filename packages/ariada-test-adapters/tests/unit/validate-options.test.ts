// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { describe, expect, it } from 'vitest';

import { AriadaTestAdapterError } from '../../src/internal/error.js';
import { ALL_RULE_PACKS, DEFAULT_SEVERITY } from '../../src/internal/types.js';
import { validateOptions } from '../../src/internal/validate-options.js';

describe('validateOptions', () => {
  it('returns defaults for undefined input', () => {
    const out = validateOptions(undefined);
    expect(out.severity).toBe(DEFAULT_SEVERITY);
    expect(out.packs).toEqual(ALL_RULE_PACKS);
    expect(out.timeoutMs).toBe(30_000);
    expect(out.locale).toBe('en');
    expect(out.exclude).toEqual([]);
  });

  it('returns defaults for empty object input', () => {
    const out = validateOptions({});
    expect(out.severity).toBe(DEFAULT_SEVERITY);
  });

  it('accepts each valid severity rung', () => {
    for (const severity of ['minor', 'moderate', 'serious', 'critical'] as const) {
      expect(validateOptions({ severity }).severity).toBe(severity);
    }
  });

  it('throws ERR_A11Y_SEVERITY_INVALID on bad severity', () => {
    try {
      validateOptions({ severity: 'fatal' as never });
      expect.fail('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(AriadaTestAdapterError);
      expect((err as AriadaTestAdapterError).code).toBe('ERR_A11Y_SEVERITY_INVALID');
    }
  });

  it('accepts each valid rule pack', () => {
    for (const pack of ALL_RULE_PACKS) {
      expect(validateOptions({ packs: [pack] }).packs).toEqual([pack]);
    }
  });

  it('throws ERR_A11Y_PACK_INVALID on unknown pack', () => {
    try {
      validateOptions({ packs: ['mystery' as never] });
      expect.fail('expected throw');
    } catch (err) {
      expect((err as AriadaTestAdapterError).code).toBe('ERR_A11Y_PACK_INVALID');
    }
  });

  it('throws ERR_A11Y_PACK_INVALID on empty packs array', () => {
    expect(() => validateOptions({ packs: [] })).toThrow(AriadaTestAdapterError);
  });

  it('dedupes pack entries', () => {
    const out = validateOptions({ packs: ['banking', 'banking', 'checkout'] });
    expect(out.packs).toEqual(['banking', 'checkout']);
  });

  it('throws RangeError with ERR_A11Y_TIMEOUT_RANGE on zero timeout', () => {
    try {
      validateOptions({ timeoutMs: 0 });
      expect.fail('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(RangeError);
      expect((err as RangeError & { code?: string }).code).toBe('ERR_A11Y_TIMEOUT_RANGE');
    }
  });

  it('throws RangeError on timeout above 120000 ms', () => {
    expect(() => validateOptions({ timeoutMs: 120_001 })).toThrow(RangeError);
  });

  it('accepts timeout boundary 120000 ms', () => {
    expect(validateOptions({ timeoutMs: 120_000 }).timeoutMs).toBe(120_000);
  });

  it('throws ERR_A11Y_LOCALE_UNSUPPORTED on unknown locale', () => {
    try {
      validateOptions({ locale: 'xx' as never });
      expect.fail('expected throw');
    } catch (err) {
      expect((err as AriadaTestAdapterError).code).toBe('ERR_A11Y_LOCALE_UNSUPPORTED');
    }
  });

  it('throws ERR_A11Y_EXCLUDE_INVALID on non-array exclude', () => {
    try {
      validateOptions({ exclude: 'string' as never });
      expect.fail('expected throw');
    } catch (err) {
      expect((err as AriadaTestAdapterError).code).toBe('ERR_A11Y_EXCLUDE_INVALID');
    }
  });

  it('throws ERR_A11Y_EXCLUDE_INVALID on empty-string exclude entry', () => {
    try {
      validateOptions({ exclude: [''] });
      expect.fail('expected throw');
    } catch (err) {
      expect((err as AriadaTestAdapterError).code).toBe('ERR_A11Y_EXCLUDE_INVALID');
    }
  });

  it('accepts valid CSS selector exclude entries', () => {
    const out = validateOptions({ exclude: ['.ad', '#banner'] });
    expect(out.exclude).toEqual(['.ad', '#banner']);
  });
});
