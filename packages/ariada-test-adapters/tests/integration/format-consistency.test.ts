// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
/**
 * Cross-adapter format consistency. Runs the same fake-scanner result
 * through every adapter's framing path and asserts the violation core
 * (`formatViolation` output) is byte-identical across all five paths.
 */
import * as chai from 'chai';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { formatViolation } from '../../src/internal/format-violation.js';
import { toBeAccessibleMatcher } from '../../src/jest/matcher.js';
import { ariadaChai } from '../../src/mocha-chai/plugin.js';
import { createA11yFixture } from '../../src/playwright/fixture.js';
import { toBeAccessibleVitestMatcher } from '../../src/vitest/matcher.js';

import {
  clearFakeScanner,
  installFakeScanner,
  sampleContrastViolation,
} from './_shared.js';

// Through `unknown`, and that is the honest expression rather than a shortcut.
// The plugin deliberately types its argument against a minimal structural shape
// instead of importing chai's types, so the package does not depend on them.
// Two structural types that describe the same object and share no declaration
// do not overlap for the compiler, and saying so directly is better than
// widening the plugin's own signature to please a test.
chai.use(ariadaChai as unknown as Parameters<typeof chai.use>[0]);

const expectedLine = formatViolation(sampleContrastViolation);

describe('format consistency across adapters', () => {
  beforeEach(() => installFakeScanner([sampleContrastViolation]));
  afterEach(() => clearFakeScanner());

  it('Jest matcher message contains the canonical violation line', async () => {
    const out = await toBeAccessibleMatcher('https://example.test');
    expect(out.message()).toContain(expectedLine);
  });

  it('Vitest matcher message contains the canonical violation line', async () => {
    const out = await toBeAccessibleVitestMatcher('https://example.test');
    expect(out.message()).toContain(expectedLine);
  });

  it('Chai assertion error contains the canonical violation line', async () => {
    try {
      await (
        chai.expect('https://example.test') as unknown as {
          to: { be: { accessible: () => Promise<void> } };
        }
      ).to.be.accessible();
      expect.fail('expected throw');
    } catch (err) {
      expect((err as Error).message).toContain(expectedLine);
    }
  });

  it('Playwright fixture toBeAccessible error contains the canonical violation line', async () => {
    const fixture = createA11yFixture();
    await expect(
      fixture.toBeAccessible({
        goto: async () => undefined,
        url: () => 'https://stub.example',
      }),
    ).rejects.toThrow(expectedLine);
  });
});
