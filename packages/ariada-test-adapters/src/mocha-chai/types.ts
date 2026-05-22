// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
// Maintainer: Alekszandr Bricskin (Agonist Development AB, Sweden, org.nr 559452-5726)
/**
 * Type-only augmentation for the Chai global. Consumers `import
 * '@ariada-org/test-adapters/mocha-chai'` once and get IDE completion for the
 * new methods.
 */

import type { ScanOptions } from '../internal/types.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Chai {
    interface Assertion {
      accessible(options?: ScanOptions): Promise<void>;
    }
    interface AssertStatic {
      isAccessible(target: unknown, options?: ScanOptions): Promise<void>;
    }
  }
}

export {};
