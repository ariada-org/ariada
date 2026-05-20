// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { describe, expect, it } from 'vitest';

import {
  findingSchema,
  findingSchemaVersion,
  severitySchema,
  regulatoryRefSchema,
} from '../src/finding-schema.js';
import { FINDING_SCHEMA_VERSION } from '../src/schema-version.js';
import type { Finding } from '../src/types.js';
import { validateAnalyzerResult, safeValidateAnalyzerResult } from '../src/validators.js';

function fixtureFinding(over: Partial<Finding> = {}): Finding {
  return {
    id: 'node-7:wcag-1.4.3-contrast-minimum',
    scanId: 'scan-abc',
    domain: 'a11y',
    ruleId: 'wcag-1.4.3-contrast-minimum',
    severity: 'serious',
    element: { selector: '.btn-primary', role: 'button', name: 'Submit' },
    message: 'Insufficient contrast ratio 2.31:1 (required 4.5:1)',
    criterion: 'WCAG 2.2 §1.4.3 Contrast (Minimum)',
    wcagMapping: ['1.4.3'],
    regulatoryMapping: [
      { framework: 'WCAG', code: '1.4.3' },
      { framework: 'EN 301 549', code: '9.1.4.3' },
    ],
    confidence: 0.95,
    ...over,
  };
}

describe('severitySchema', () => {
  it('accepts the 4 canonical severities', () => {
    for (const s of ['critical', 'serious', 'moderate', 'minor'] as const) {
      expect(severitySchema.parse(s)).toBe(s);
    }
  });

  it('rejects unknown severity', () => {
    expect(() => severitySchema.parse('catastrophic')).toThrow();
  });

  it('rejects non-string severity', () => {
    expect(() => severitySchema.parse(2)).toThrow();
  });
});

describe('regulatoryRefSchema', () => {
  it('accepts the 6 declared frameworks', () => {
    for (const fw of ['WCAG', 'EN 301 549', 'ADA', 'EAA', 'GDPR', 'Section 508'] as const) {
      expect(regulatoryRefSchema.parse({ framework: fw, code: '1.0' })).toEqual({
        framework: fw,
        code: '1.0',
      });
    }
  });

  it('rejects unknown framework', () => {
    expect(() => regulatoryRefSchema.parse({ framework: 'NIST', code: 'CSF-1' })).toThrow();
  });

  it('rejects empty code', () => {
    expect(() => regulatoryRefSchema.parse({ framework: 'WCAG', code: '' })).toThrow();
  });
});

describe('findingSchema — positive parses', () => {
  it('parses the canonical fixture', () => {
    const parsed = findingSchema.parse(fixtureFinding());
    expect(parsed.id).toBe('node-7:wcag-1.4.3-contrast-minimum');
    expect(parsed.severity).toBe('serious');
    expect(parsed.regulatoryMapping?.[0]?.framework).toBe('WCAG');
  });

  it('parses a minimal finding (only required fields)', () => {
    const minimal: Finding = {
      id: 'x',
      scanId: 's',
      domain: 'cwv',
      ruleId: 'r',
      severity: 'minor',
      element: { selector: 'div' },
      message: 'hello',
    };
    expect(findingSchema.parse(minimal).domain).toBe('cwv');
  });

  it('accepts open string `domain` (third-party)', () => {
    expect(findingSchema.parse(fixtureFinding({ domain: 'i18n' })).domain).toBe('i18n');
  });
});

describe('findingSchema — negative parses', () => {
  it('rejects missing required field', () => {
    const { id: _omitted, ...withoutId } = fixtureFinding();
    expect(() => findingSchema.parse(withoutId)).toThrow();
  });

  it('rejects empty ruleId', () => {
    expect(() => findingSchema.parse(fixtureFinding({ ruleId: '' }))).toThrow();
  });

  it('rejects unknown severity literal', () => {
    expect(() =>
      findingSchema.parse({ ...fixtureFinding(), severity: 'catastrophic' }),
    ).toThrow();
  });

  it('rejects confidence outside 0..1', () => {
    expect(() => findingSchema.parse(fixtureFinding({ confidence: 1.5 }))).toThrow();
    expect(() => findingSchema.parse(fixtureFinding({ confidence: -0.1 }))).toThrow();
  });

  it('rejects malformed regulatoryMapping (unknown framework)', () => {
    expect(() =>
      findingSchema.parse(
        fixtureFinding({
          regulatoryMapping: [{ framework: 'NIST' as never, code: 'CSF' }],
        }),
      ),
    ).toThrow();
  });
});

describe('findingSchema — round-trip', () => {
  it('serialise → parse → deep equal', () => {
    const f = fixtureFinding();
    const serialised = JSON.parse(JSON.stringify(f));
    const reparsed = findingSchema.parse(serialised);
    expect(reparsed).toEqual(f);
  });

  it('parse(parse(x)) is idempotent (PRD test 14)', () => {
    const f = fixtureFinding();
    const once = findingSchema.parse(f);
    const twice = findingSchema.parse(once);
    expect(twice).toEqual(once);
  });
});

describe('validateAnalyzerResult helper', () => {
  it('returns typed Finding on valid input', () => {
    const result = validateAnalyzerResult(fixtureFinding());
    expect(result.severity).toBe('serious');
  });

  it('throws ZodError on invalid input', () => {
    expect(() => validateAnalyzerResult({ wrong: 'shape' })).toThrow();
  });

  it('safeValidateAnalyzerResult returns ok=false on invalid', () => {
    const r = safeValidateAnalyzerResult({ wrong: 'shape' });
    expect(r.ok).toBe(false);
  });

  it('safeValidateAnalyzerResult returns ok=true + value on valid', () => {
    const r = safeValidateAnalyzerResult(fixtureFinding());
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.scanId).toBe('scan-abc');
  });
});

describe('schema version constant', () => {
  it('is stamped at 0.1 for v0.1.0 release', () => {
    expect(FINDING_SCHEMA_VERSION).toBe('0.1');
    expect(findingSchemaVersion).toBe('0.1');
  });
});
