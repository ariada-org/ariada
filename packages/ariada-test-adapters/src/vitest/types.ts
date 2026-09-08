// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
// Maintainer: Alexander Brichkin (Agonist Development AB, Sweden, org.nr 559452-5726)
/**
 * Vitest ambient module augmentation. Consumers `import
 * '@ariada-org/test-adapters/vitest'` from their setup file; this declaration
 * extends Vitest's `Assertion` and `ExpectStatic` interfaces so the matcher
 * typechecks at usage sites.
 */

import 'vitest';

import type { ScanOptions } from '../internal/types.js';

declare module 'vitest' {
  // Vitest declares `Assertion<T>` (no default). Mirror the same shape so
  // both declarations merge cleanly without TS2428. The result is `void`
  // rather than `T` because the inherited matcher interface says `void`, and
  // a merged member that widens the inherited return type is rejected — by
  // the next compiler version, though not by the current one. Nothing reads an
  // assertion's result anyway.
  // The parameter has to be named `T` and cannot be renamed to the underscore
  // form the linter wants: merging requires identical type parameters, and a
  // rename is rejected as a conflicting declaration.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface Assertion<T> {
    toBeAccessible(options?: ScanOptions): Promise<void>;
  }
  interface AsymmetricMatchersContaining {
    toBeAccessible(options?: ScanOptions): unknown;
  }
}

export {};
