// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
/**
 * Vitest adapter integration test. Same strategy as Jest — call the matcher
 * directly so the test stays deterministic and fast.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { toBeAccessibleVitestMatcher } from '../../src/vitest/matcher.js';

import {
  clearFakeScanner,
  installFakeScanner,
  sampleContrastViolation,
} from './_shared.js';

describe('Vitest toBeAccessible matcher', () => {
  beforeEach(() => installFakeScanner([sampleContrastViolation]));
  afterEach(() => clearFakeScanner());

  it('returns pass=false and includes a formatted message on violation', async () => {
    const result = await toBeAccessibleVitestMatcher('https://example.test');
    expect(result.pass).toBe(false);
    expect(result.message()).toContain('WCAG 1.4.3');
  });

  it('attaches the raw ScanResult as `actual` for reporter consumption', async () => {
    const result = await toBeAccessibleVitestMatcher('https://example.test');
    expect(result.actual).toBeDefined();
    expect((result.actual as { violations: unknown[] }).violations.length).toBe(1);
  });

  it('passes when scan returns no violations', async () => {
    clearFakeScanner();
    installFakeScanner([]);
    const result = await toBeAccessibleVitestMatcher('https://example.test');
    expect(result.pass).toBe(true);
  });
});
