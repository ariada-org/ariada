// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
// Maintainer: Alexander Brichkin (Agonist Development AB, Sweden, org.nr 559452-5726)
/**
 * Jest entry. Side-effectful import: registers `toBeAccessible` on the
 * Jest `expect` global the first time this module is loaded.
 *
 * Usage in a Jest setup file:
 *
 * ```ts
 * import '@ariada-org/test-adapters/jest';
 * // Then in any test:
 * await expect('https://example.com').toBeAccessible();
 * ```
 */

import { toBeAccessibleMatcher } from './matcher.js';
import './types.js';

/**
 * Minimum surface of the Jest `expect` global we depend on. Declared
 * structurally so we never have to add `@types/jest` as a hard dep.
 */
interface ExpectGlobal {
  extend(matchers: Record<string, unknown>): void;
}

/**
 * Programmatic registration helper. Auto-runs on import via the bottom
 * statement, but exposed so consumers can re-register in custom test
 * harnesses.
 */
export function registerJestMatcher(target?: ExpectGlobal): void {
  const expectGlobal =
    target ?? ((globalThis as { expect?: ExpectGlobal }).expect as ExpectGlobal | undefined);
  if (!expectGlobal || typeof expectGlobal.extend !== 'function') {
    // Defer silently — caller may be importing in a non-Jest context (e.g. a
    // setup file precompiled by tsc). Re-running `registerJestMatcher(expect)`
    // after Jest's expect is available will complete the wiring.
    return;
  }
  expectGlobal.extend({ toBeAccessible: toBeAccessibleMatcher });
}

registerJestMatcher();

export { toBeAccessibleMatcher } from './matcher.js';
export type { MatcherResult } from './matcher.js';
