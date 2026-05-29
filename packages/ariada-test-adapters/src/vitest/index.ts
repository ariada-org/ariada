// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
// Maintainer: Alexander Brichkin (Agonist Development AB, Sweden, org.nr 559452-5726)
/**
 * Vitest entry. Registers `toBeAccessible` on the Vitest `expect` global the
 * first time this module is loaded.
 *
 * Usage in a Vitest setup file:
 *
 * ```ts
 * import '@ariada-org/test-adapters/vitest';
 * // Then in any test:
 * await expect('https://example.com').toBeAccessible();
 * ```
 */

import { toBeAccessibleVitestMatcher } from './matcher.js';

/**
 * Minimum surface of the Vitest `expect` global we depend on.
 */
interface ExpectGlobal {
  extend(matchers: Record<string, unknown>): void;
}

/**
 * Programmatic registration helper. Safe to call multiple times.
 */
export function registerVitestMatcher(target?: ExpectGlobal): void {
  const expectGlobal =
    target ?? ((globalThis as { expect?: ExpectGlobal }).expect as ExpectGlobal | undefined);
  if (!expectGlobal || typeof expectGlobal.extend !== 'function') {
    return;
  }
  expectGlobal.extend({ toBeAccessible: toBeAccessibleVitestMatcher });
}

registerVitestMatcher();

export { toBeAccessibleVitestMatcher } from './matcher.js';
export type { VitestMatcherResult } from './matcher.js';
