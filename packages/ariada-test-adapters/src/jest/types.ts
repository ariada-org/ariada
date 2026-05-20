// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
// Maintainer: Alekszandr Bricskin (Agonist Development AB, Sweden, org.nr 559452-5726)
/**
 * Jest module augmentation. Consumers `import '@ariada/test-adapters/jest'`
 * in their setup file once; this declaration extends Jest's `Matchers`
 * interface so `expect(target).toBeAccessible(opts?)` typechecks.
 */

import type { ScanOptions } from '../internal/types.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace jest {
    // Type parameters mirror the Vitest-shipped declaration of the same
    // namespace so both can co-exist in the same project without TS2428.
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface Matchers<R, T = {}> {
      toBeAccessible(options?: ScanOptions): Promise<R>;
      // Mark T as used at the type level so noUnusedParameters in strict
      // tsconfigs doesn't bark. T is reserved for future per-target
      // narrowing — granular per-rule matchers are tracked for a later release.
      readonly _target?: T;
    }
  }
}

export {};
