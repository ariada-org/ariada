// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
// Maintainer: Alekszandr Bricskin (Agonist Development AB, Sweden, org.nr 559452-5726)
/**
 * Jest `toBeAccessible` matcher implementation.
 *
 * Returns the `MatcherResult` shape Jest expects (`{ pass, message }`). The
 * matcher is framework-shape only — all real work lives in
 * `internal/assert-accessible.ts`.
 */

import { assertAccessible } from '../internal/assert-accessible.js';
import type { RawScanTarget } from '../internal/normalise-target.js';
import type { ScanOptions, ScanResult } from '../internal/types.js';

/**
 * Shape Jest expects from a custom matcher.
 */
export interface MatcherResult {
  pass: boolean;
  message: () => string;
}

/**
 * Implementation of `expect(target).toBeAccessible(options?)`. Marked `async`
 * because the scan is asynchronous; Jest 27+ awaits the returned Promise.
 */
export async function toBeAccessibleMatcher(
  received: RawScanTarget | ScanResult,
  options?: ScanOptions,
): Promise<MatcherResult> {
  const outcome = await assertAccessible(received, options);
  return {
    pass: outcome.pass,
    message: () => outcome.message,
  };
}
