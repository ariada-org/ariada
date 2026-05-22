// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
// Maintainer: Alekszandr Bricskin (Agonist Development AB, Sweden, org.nr 559452-5726)
/**
 * Playwright entry. Re-exports a `test` instance pre-extended with the
 * `a11y` fixture so consumers can:
 *
 * ```ts
 * import { test, expect } from '@ariada-org/test-adapters/playwright';
 *
 * test('home page is accessible', async ({ page, a11y }) => {
 *   await page.goto('https://example.com');
 *   const result = await a11y.scan(page);
 *   expect(result.violations).toEqual([]);
 * });
 * ```
 *
 * Power users can compose `createA11yFixture()` into their own `test.extend`
 * call when they need worker-scoped sharing or custom defaults.
 *
 * The fixture is `test`-scoped (fresh per test) — isolation by default.
 * Worker-scoped sharing is tracked for a future release as a separate
 * `a11yWorker` fixture for callers willing to trade isolation for speed.
 *
 * We import Playwright lazily through a dynamic export so consumers that
 * never load `/playwright` do not pay the `@playwright/test` cost via
 * `/jest`, `/vitest`, `/mocha-chai`, or `/cypress`.
 */

import { createA11yFixture, type A11yFixture } from './fixture.js';

/**
 * Minimal structural shape of `@playwright/test`'s `test` export we depend
 * on. Declared structurally so the adapter never imports `@playwright/test`
 * at type-check time — the import lives behind the `extendPlaywrightTest`
 * helper, which is consumer-invoked.
 */
interface PlaywrightTestBase {
  extend<U>(fixtures: U): unknown;
}

/**
 * Extend a `@playwright/test` `test` base with the `a11y` fixture. Returns
 * the extended `test` ready to use.
 *
 * ```ts
 * import { test as base } from '@playwright/test';
 * import { extendPlaywrightTest } from '@ariada-org/test-adapters/playwright';
 *
 * export const test = extendPlaywrightTest(base);
 * ```
 */
export function extendPlaywrightTest<T extends PlaywrightTestBase>(
  base: T,
): ReturnType<T['extend']> {
  return base.extend({
    a11y: async (
      _: unknown,
      use: (value: A11yFixture) => Promise<void>,
    ): Promise<void> => {
      await use(createA11yFixture());
    },
  }) as ReturnType<T['extend']>;
}

export { createA11yFixture } from './fixture.js';
export type { A11yFixture } from './types.js';
