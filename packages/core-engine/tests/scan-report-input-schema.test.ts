// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { describe, expect, it } from 'vitest';

import {
  scanReportInputSchema,
  scanReportInputSchemaVersion,
  type ScanReportInput,
} from '../src/scan-report-input-schema.js';
import { SCAN_REPORT_INPUT_SCHEMA_VERSION } from '../src/schema-version.js';
import { validateScanReportInput } from '../src/validators.js';

function fixtureScanReportInput(over: Partial<ScanReportInput> = {}): ScanReportInput {
  return {
    schemaVersion: '0.1',
    scanId: 'scan-xyz',
    url: 'https://example.com',
    generatedAt: 1_700_000_000_000,
    findings: [
      {
        id: 'node-1:wcag-1.4.3-contrast-minimum',
        scanId: 'scan-xyz',
        domain: 'a11y',
        ruleId: 'wcag-1.4.3-contrast-minimum',
        severity: 'serious',
        element: { selector: '.btn' },
        message: 'Low contrast',
      },
    ],
    counts: { critical: 0, serious: 1, moderate: 0, minor: 0 },
    score: 82,
    ...over,
  };
}

describe('scanReportInputSchema', () => {
  it('parses full fixture', () => {
    expect(scanReportInputSchema.parse(fixtureScanReportInput()).scanId).toBe('scan-xyz');
  });

  it('rejects schemaVersion mismatch (PRD test — version routing)', () => {
    expect(() =>
      scanReportInputSchema.parse({ ...fixtureScanReportInput(), schemaVersion: '99.9' }),
    ).toThrow();
  });

  it('rejects score > 100', () => {
    expect(() => scanReportInputSchema.parse(fixtureScanReportInput({ score: 105 }))).toThrow();
  });

  it('rejects score < 0', () => {
    expect(() => scanReportInputSchema.parse(fixtureScanReportInput({ score: -1 }))).toThrow();
  });

  it('rejects malformed nested finding', () => {
    expect(() =>
      scanReportInputSchema.parse(
        fixtureScanReportInput({
          findings: [{ wrong: 'shape' } as never],
        }),
      ),
    ).toThrow();
  });

  it('round-trip via JSON', () => {
    const r = fixtureScanReportInput();
    expect(scanReportInputSchema.parse(JSON.parse(JSON.stringify(r)))).toEqual(r);
  });

  it('validateScanReportInput helper returns typed value', () => {
    expect(validateScanReportInput(fixtureScanReportInput()).score).toBe(82);
  });

  it('schemaVersion literal exported = 0.1', () => {
    expect(SCAN_REPORT_INPUT_SCHEMA_VERSION).toBe('0.1');
    expect(scanReportInputSchemaVersion).toBe('0.1');
  });
});
