// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
// Maintainer: Alekszandr Bricskin (Agonist Development AB, Sweden, org.nr 559452-5726)
/**
 * Vitest ambient module augmentation. Consumers `import
 * '@ariada/test-adapters/vitest'` from their setup file; this declaration
 * extends Vitest's `Assertion` and `ExpectStatic` interfaces so the matcher
 * typechecks at usage sites.
 */

import 'vitest';

import type { ScanOptions } from '../internal/types.js';

declare module 'vitest' {
  // Vitest declares `Assertion<T>` (no default). Mirror the same shape so
  // both declarations merge cleanly without TS2428.
  interface Assertion<T> {
    toBeAccessible(options?: ScanOptions): Promise<T>;
  }
  interface AsymmetricMatchersContaining {
    toBeAccessible(options?: ScanOptions): unknown;
  }
}

export {};
