// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { describe, expect, it } from 'vitest';

import { VPAT_INPUT_SCHEMA_VERSION } from '../src/schema-version.js';
import { validateVpatInput } from '../src/validators.js';
import {
  vpatInputSchema,
  vpatInputSchemaVersion,
  type VpatInput,
} from '../src/vpat-input-schema.js';

function fixtureVpat(over: Partial<VpatInput> = {}): VpatInput {
  return {
    schemaVersion: '0.1',
    product: { name: 'Ariada Scanner', version: '0.1.0' },
    vendor: { name: 'Agonist Development AB', contactEmail: 'security@ariada.org' },
    evaluatedAt: 1_700_000_000_000,
    standards: ['WCAG-2.2', 'EN-301-549'],
    criteria: [
      { id: '1.4.3', title: 'Contrast (Minimum)', level: 'supports' },
      { id: '2.1.1', title: 'Keyboard', level: 'partially-supports', remarks: 'Modal dialog' },
    ],
    ...over,
  };
}

describe('vpatInputSchema', () => {
  it('parses full fixture', () => {
    expect(vpatInputSchema.parse(fixtureVpat()).product.name).toBe('Ariada Scanner');
  });

  it('rejects empty standards array', () => {
    expect(() => vpatInputSchema.parse({ ...fixtureVpat(), standards: [] })).toThrow();
  });

  it('rejects empty criteria array', () => {
    expect(() => vpatInputSchema.parse({ ...fixtureVpat(), criteria: [] })).toThrow();
  });

  it('rejects unknown conformance level', () => {
    expect(() =>
      vpatInputSchema.parse(
        fixtureVpat({
          criteria: [{ id: '1.1.1', title: 'Non-text', level: 'maybe' as never }],
        }),
      ),
    ).toThrow();
  });

  it('rejects unknown standard', () => {
    expect(() =>
      vpatInputSchema.parse({
        ...fixtureVpat(),
        standards: ['WCAG-9.9' as never],
      }),
    ).toThrow();
  });

  it('rejects malformed contact email', () => {
    expect(() =>
      vpatInputSchema.parse(
        fixtureVpat({ vendor: { name: 'X', contactEmail: 'not-an-email' } }),
      ),
    ).toThrow();
  });

  it('round-trip via JSON', () => {
    const v = fixtureVpat();
    expect(vpatInputSchema.parse(JSON.parse(JSON.stringify(v)))).toEqual(v);
  });

  it('rejects schemaVersion mismatch', () => {
    expect(() => vpatInputSchema.parse({ ...fixtureVpat(), schemaVersion: '0.2' })).toThrow();
  });

  it('validateVpatInput helper returns typed value', () => {
    expect(validateVpatInput(fixtureVpat()).standards).toContain('WCAG-2.2');
  });

  it('schemaVersion literal = 0.1', () => {
    expect(VPAT_INPUT_SCHEMA_VERSION).toBe('0.1');
    expect(vpatInputSchemaVersion).toBe('0.1');
  });
});
