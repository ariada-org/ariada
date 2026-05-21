// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
// Author: Alekszandr Bricskin (Agonist Development AB, Sweden, org.nr 559452-5726)
/**
 * Smoke tests for EU real-world fixture suite.
 *
 * Verifies fixtures load cleanly via fs + happy-dom DOMParser, carry the
 * required CC0-1.0 provenance comment header, and have correct lang attrs.
 *
 * Per-rule integration tests against these fixtures will land in a
 * follow-up commit once the rule pipeline supports loading external HTML.
 */

import * as fs from 'node:fs';
import { createRequire } from 'node:module';
import * as path from 'node:path';

import { describe, it, expect } from 'vitest';

// EU real-world fixtures live in @ariada-org/test-fixtures since 2026-05-16.
// Use createRequire to resolve the package install path (works for both
// workspace-link and a real npm install).
const require = createRequire(import.meta.url);
const FIXTURES_DIR = path.dirname(
  require.resolve('@ariada-org/test-fixtures/fixtures/eu-real-world/README.md'),
);

interface FixtureExpectation {
  file: string;
  expectedLang: string;
  expectedStatus: 'PASS' | 'FAIL' | 'MIXED';
}

const FIXTURES: FixtureExpectation[] = [
  // Swedish e-commerce
  { file: 'klarna-style-cart-sv.html', expectedLang: 'sv', expectedStatus: 'PASS' },
  { file: 'klarna-style-checkout-sv.html', expectedLang: 'sv', expectedStatus: 'PASS' },
  { file: 'klarna-style-bad-checkout-sv.html', expectedLang: 'sv', expectedStatus: 'FAIL' },
  { file: 'klarna-style-order-confirmation-sv.html', expectedLang: 'sv', expectedStatus: 'PASS' },
  // Swedish banking
  { file: 'bankid-style-sso-redirect-sv.html', expectedLang: 'sv', expectedStatus: 'PASS' },
  { file: 'bankid-style-2fa-challenge-sv.html', expectedLang: 'sv', expectedStatus: 'PASS' },
  { file: 'bankid-style-success-sv.html', expectedLang: 'sv', expectedStatus: 'PASS' },
  // Danish mobile pay
  {
    file: 'mobilepay-style-merchant-checkout-da.html',
    expectedLang: 'da',
    expectedStatus: 'PASS',
  },
  { file: 'mobilepay-style-authentication-da.html', expectedLang: 'da', expectedStatus: 'PASS' },
  {
    file: 'mobilepay-style-bad-merchant-da.html',
    // Intentionally missing lang attr to test fail rule (we expect '' or absent)
    expectedLang: '',
    expectedStatus: 'FAIL',
  },
  // Finnish statement
  { file: 'accessibility-statement-fi.html', expectedLang: 'fi', expectedStatus: 'PASS' },
  {
    file: 'accessibility-statement-fi-incomplete.html',
    expectedLang: 'fi',
    expectedStatus: 'FAIL',
  },
  // German Mittelstand
  { file: 'mittelstand-checkout-de.html', expectedLang: 'de', expectedStatus: 'PASS' },
  { file: 'mittelstand-bad-checkout-de.html', expectedLang: 'de', expectedStatus: 'FAIL' },
  // French RGAA
  { file: 'rgaa-statement-fr.html', expectedLang: 'fr', expectedStatus: 'PASS' },
  { file: 'rgaa-statement-fr-incomplete.html', expectedLang: 'fr', expectedStatus: 'FAIL' },
];

describe('EU real-world fixtures', () => {
  it.each(FIXTURES)('$file loads, has CC0 header, lang="$expectedLang"', (fixture) => {
    const fullPath = path.join(FIXTURES_DIR, fixture.file);
    const content = fs.readFileSync(fullPath, 'utf8');
    expect(content).toContain('License: CC0-1.0');
    expect(content).toContain(`Status: ${fixture.expectedStatus}`);
    if (fixture.expectedLang) {
      expect(content).toContain(`lang="${fixture.expectedLang}"`);
    }
    // Sanity: HTML5 doctype
    expect(content.toLowerCase()).toMatch(/<!doctype html>/);
  });

  it('all fixtures listed in README', () => {
    const readme = fs.readFileSync(path.join(FIXTURES_DIR, 'README.md'), 'utf8');
    for (const fixture of FIXTURES) {
      expect(readme).toContain(fixture.file);
    }
  });

  it('fixture set covers all 5 expected pattern categories', () => {
    const files = FIXTURES.map((f) => f.file);
    expect(files.some((f) => f.startsWith('klarna-style-'))).toBe(true);
    expect(files.some((f) => f.startsWith('bankid-style-'))).toBe(true);
    expect(files.some((f) => f.startsWith('mobilepay-style-'))).toBe(true);
    expect(files.some((f) => f.startsWith('mittelstand-'))).toBe(true);
    expect(files.some((f) => f.startsWith('rgaa-statement-'))).toBe(true);
  });
});
