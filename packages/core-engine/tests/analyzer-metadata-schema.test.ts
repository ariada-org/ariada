// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { describe, expect, it } from 'vitest';

import { analyzerMetadataSchema } from '../src/analyzer-metadata-schema.js';
import type { AnalyzerMetadata } from '../src/types.js';
import { validateAnalyzerMetadata } from '../src/validators.js';

function fixtureMetadata(over: Partial<AnalyzerMetadata> = {}): AnalyzerMetadata {
  return {
    displayName: 'Color Contrast (Minimum)',
    description: 'Detects insufficient contrast ratio per WCAG 2.2 SC 1.4.3.',
    helpUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum',
    defaultSeverity: 'serious',
    regulatoryMappings: [
      { framework: 'WCAG', code: '1.4.3' },
      { framework: 'EN 301 549', code: '9.1.4.3' },
    ],
    wcagSuccessCriteria: ['1.4.3'],
    en301549Clauses: ['9.1.4.3'],
    tags: ['contrast', 'text', 'visual'],
    ...over,
  };
}

describe('analyzerMetadataSchema', () => {
  it('parses full fixture', () => {
    const m = analyzerMetadataSchema.parse(fixtureMetadata());
    expect(m.displayName).toBe('Color Contrast (Minimum)');
  });

  it('parses minimal (only required fields)', () => {
    expect(
      analyzerMetadataSchema.parse({
        displayName: 'X',
        description: 'Y',
        defaultSeverity: 'minor',
        regulatoryMappings: [],
      }).defaultSeverity,
    ).toBe('minor');
  });

  it('rejects empty displayName', () => {
    expect(() =>
      analyzerMetadataSchema.parse(fixtureMetadata({ displayName: '' })),
    ).toThrow();
  });

  it('rejects unknown defaultSeverity', () => {
    expect(() =>
      analyzerMetadataSchema.parse({
        ...fixtureMetadata(),
        defaultSeverity: 'catastrophic',
      }),
    ).toThrow();
  });

  it('round-trips via JSON', () => {
    const m = fixtureMetadata();
    const round = analyzerMetadataSchema.parse(JSON.parse(JSON.stringify(m)));
    expect(round).toEqual(m);
  });

  it('validateAnalyzerMetadata helper returns typed value', () => {
    expect(validateAnalyzerMetadata(fixtureMetadata()).defaultSeverity).toBe('serious');
  });

  it('validateAnalyzerMetadata helper throws on invalid', () => {
    expect(() => validateAnalyzerMetadata({ displayName: 'X' })).toThrow();
  });
});
