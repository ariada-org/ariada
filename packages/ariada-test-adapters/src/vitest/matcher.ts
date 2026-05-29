// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
// Maintainer: Alexander Brichkin (Agonist Development AB, Sweden, org.nr 559452-5726)
/**
 * Vitest `toBeAccessible` matcher implementation. Vitest follows the same
 * `{ pass, message }` contract as Jest plus an optional `actual` field for
 * richer diff rendering.
 */

import { assertAccessible } from '../internal/assert-accessible.js';
import type { RawScanTarget } from '../internal/normalise-target.js';
import type { ScanOptions, ScanResult } from '../internal/types.js';

/**
 * Shape Vitest expects from a custom matcher. `actual` is optional and used
 * for richer reporter output.
 */
export interface VitestMatcherResult {
  pass: boolean;
  message: () => string;
  actual?: unknown;
}

/**
 * `expect(received).toBeAccessible(options?)` body.
 */
export async function toBeAccessibleVitestMatcher(
  received: RawScanTarget | ScanResult,
  options?: ScanOptions,
): Promise<VitestMatcherResult> {
  const outcome = await assertAccessible(received, options);
  return {
    pass: outcome.pass,
    message: () => outcome.message,
    actual: outcome.result,
  };
}
