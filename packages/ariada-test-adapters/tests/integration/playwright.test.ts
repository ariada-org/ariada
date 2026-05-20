// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
/**
 * Playwright adapter integration test. Drives `createA11yFixture()` directly
 * + verifies `extendPlaywrightTest` returns an extended-test wrapper without
 * launching a real browser. Real-browser coverage is deferred to
 * `core-playwright`'s own e2e suite per PRD §6.3.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { PageLike } from '../../src/internal/types.js';
import { createA11yFixture, extendPlaywrightTest } from '../../src/playwright/index.js';

import {
  clearFakeScanner,
  installFakeScanner,
  sampleContrastViolation,
} from './_shared.js';

const fakePage: PageLike = {
  goto: async () => undefined,
  url: () => 'https://stub.example',
};

describe('Playwright a11y fixture', () => {
  beforeEach(() => installFakeScanner([sampleContrastViolation]));
  afterEach(() => clearFakeScanner());

  it('scan() returns a reusable ScanResult callers can re-assert against', async () => {
    const fixture = createA11yFixture();
    const result = await fixture.scan(fakePage);
    expect(result.violations).toHaveLength(1);
    expect(result.target.identifier).toBe('https://stub.example');
  });

  it('toBeAccessible() throws on violation', async () => {
    const fixture = createA11yFixture();
    await expect(fixture.toBeAccessible(fakePage)).rejects.toThrow(/WCAG/);
  });

  it('toBeAccessible() passes when scan is clean', async () => {
    clearFakeScanner();
    installFakeScanner([]);
    const fixture = createA11yFixture();
    await expect(fixture.toBeAccessible(fakePage)).resolves.toBeUndefined();
  });

  it('extendPlaywrightTest wraps the base test with an a11y fixture', () => {
    const recorded: unknown[] = [];
    const fakeBase = {
      extend(fixtures: unknown): unknown {
        recorded.push(fixtures);
        return { extended: true };
      },
    };
    const extended = extendPlaywrightTest(fakeBase) as { extended: boolean };
    expect(extended.extended).toBe(true);
    expect(recorded).toHaveLength(1);
    expect(typeof (recorded[0] as { a11y?: unknown }).a11y).toBe('function');
  });
});
