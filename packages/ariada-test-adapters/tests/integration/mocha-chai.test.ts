// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
/**
 * Mocha + Chai adapter integration test. Drives the plugin via a real Chai
 * import (devDep) so we exercise the actual `addMethod` registration.
 */
import * as chai from 'chai';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ariadaChai } from '../../src/mocha-chai/plugin.js';

import {
  clearFakeScanner,
  installFakeScanner,
  sampleContrastViolation,
} from './_shared.js';

// Register the plugin once for the whole suite.
chai.use(ariadaChai as Parameters<typeof chai.use>[0]);

describe('Mocha + Chai accessible() plugin', () => {
  beforeEach(() => installFakeScanner([sampleContrastViolation]));
  afterEach(() => clearFakeScanner());

  it('throws an AssertionError on violation', async () => {
    try {
      await (
        chai.expect('https://example.test') as unknown as { to: { be: { accessible: () => Promise<void> } } }
      ).to.be.accessible();
      expect.fail('expected throw');
    } catch (err) {
      expect((err as Error).message).toMatch(/WCAG/);
    }
  });

  it('passes silently when scan is clean', async () => {
    clearFakeScanner();
    installFakeScanner([]);
    await expect(
      (
        chai.expect('https://example.test') as unknown as {
          to: { be: { accessible: () => Promise<void> } };
        }
      ).to.be.accessible(),
    ).resolves.toBeUndefined();
  });

  it('exposes assert.isAccessible(target)', async () => {
    clearFakeScanner();
    installFakeScanner([]);
    const isAccessible = (chai.assert as unknown as { isAccessible: (t: string) => Promise<void> })
      .isAccessible;
    await expect(isAccessible('https://example.test')).resolves.toBeUndefined();
  });
});
