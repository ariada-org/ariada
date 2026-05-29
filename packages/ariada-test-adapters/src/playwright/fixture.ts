// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
// Maintainer: Alexander Brichkin (Agonist Development AB, Sweden, org.nr 559452-5726)
/**
 * Playwright `a11y` fixture factory. Returns the object Playwright's
 * `test.extend` call will attach to every test's `a11y` argument.
 */

import { assertAccessible } from '../internal/assert-accessible.js';
import { normaliseTarget, type RawScanTarget } from '../internal/normalise-target.js';
import { runScan } from '../internal/run-scan.js';
import type { PageLike, ScanOptions, ScanResult } from '../internal/types.js';
import { validateOptions } from '../internal/validate-options.js';

/**
 * Shape exposed to test bodies. The `scan` method is the reusable-result
 * entry point — callers bind it to a variable and feed it to
 * `toBeAccessible` (or to other granular matchers in a future release).
 */
export interface A11yFixture {
  /**
   * Run a scan and return a `ScanResult` the caller can reuse across
   * multiple assertions in the same test.
   */
  scan(target: PageLike | RawScanTarget, options?: ScanOptions): Promise<ScanResult>;
  /**
   * Convenience helper — scan + assert in one call. Throws on failure with a
   * formatted message including WCAG SC + selector per violation.
   */
  toBeAccessible(target: PageLike | RawScanTarget, options?: ScanOptions): Promise<void>;
}

/**
 * Build the fixture instance. Exported separately so power users can compose
 * it into their own `test.extend` calls without importing the wrapper below.
 */
export function createA11yFixture(): A11yFixture {
  return {
    async scan(target, options) {
      const opts = validateOptions(options);
      return runScan(normaliseTarget(target), opts);
    },
    async toBeAccessible(target, options) {
      const outcome = await assertAccessible(target, options);
      if (!outcome.pass) {
        throw new Error(outcome.message);
      }
    },
  };
}
