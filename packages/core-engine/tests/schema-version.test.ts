// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { describe, expect, it } from 'vitest';

import { SCHEMAS_BASE, SCHEMA_URLS } from '../src/schema-version.js';

describe('SCHEMAS_BASE', () => {
  it('points at https://schemas.ariada.org (NOT .ai)', () => {
    expect(SCHEMAS_BASE).toBe('https://schemas.ariada.org');
    expect(SCHEMAS_BASE).not.toContain('.ai');
  });
});

describe('SCHEMA_URLS', () => {
  it('builds fully-qualified URLs per schema', () => {
    expect(SCHEMA_URLS.finding).toBe('https://schemas.ariada.org/finding/0.1.json');
    expect(SCHEMA_URLS.snapshot).toBe('https://schemas.ariada.org/snapshot/0.1.json');
    expect(SCHEMA_URLS.analyzerMetadata).toBe(
      'https://schemas.ariada.org/analyzer-metadata/0.1.json',
    );
    expect(SCHEMA_URLS.scanEvent).toBe('https://schemas.ariada.org/scan-event/0.1.json');
    expect(SCHEMA_URLS.scanReportInput).toBe(
      'https://schemas.ariada.org/scan-report-input/0.1.json',
    );
    expect(SCHEMA_URLS.vpatInput).toBe('https://schemas.ariada.org/vpat-input/0.1.json');
  });

  it('every URL is HTTPS', () => {
    for (const url of Object.values(SCHEMA_URLS)) {
      expect(url.startsWith('https://')).toBe(true);
    }
  });
});
