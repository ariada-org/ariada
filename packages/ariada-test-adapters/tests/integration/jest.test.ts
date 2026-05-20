// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
/**
 * Jest adapter integration test. We exercise the matcher body directly
 * (`toBeAccessibleMatcher`) rather than spawning a child Jest process — that
 * adds 5+ seconds per run and contributes zero additional coverage given the
 * matcher is itself pure data marshalling.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { toBeAccessibleMatcher } from '../../src/jest/matcher.js';

import {
  clearFakeScanner,
  installFakeScanner,
  sampleContrastViolation,
} from './_shared.js';

describe('Jest toBeAccessible matcher', () => {
  beforeEach(() => installFakeScanner([sampleContrastViolation]));
  afterEach(() => clearFakeScanner());

  it('returns pass=false with a formatted message on violation', async () => {
    const result = await toBeAccessibleMatcher('https://example.test');
    expect(result.pass).toBe(false);
    expect(result.message()).toContain('WCAG 1.4.3');
    expect(result.message()).toContain('color-contrast');
    expect(result.message()).toContain('.price-label');
  });

  it('returns pass=true when no violations meet the threshold', async () => {
    clearFakeScanner();
    installFakeScanner([]);
    const result = await toBeAccessibleMatcher('https://example.test');
    expect(result.pass).toBe(true);
  });

  it('respects a stricter critical threshold', async () => {
    const result = await toBeAccessibleMatcher('https://example.test', { severity: 'critical' });
    // sample violation is severity=serious, so critical threshold ignores it
    expect(result.pass).toBe(true);
  });
});
