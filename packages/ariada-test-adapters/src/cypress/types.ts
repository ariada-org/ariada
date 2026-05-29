// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
// Maintainer: Alexander Brichkin (Agonist Development AB, Sweden, org.nr 559452-5726)
/**
 * Cypress namespace augmentation. Adds `cy.checkA11y(options?)` to the
 * chainable surface. The return type is `Chainable<unknown>` because the
 * command is a child command and the prior subject (if any) flows through.
 */

import type { ScanOptions } from '../internal/types.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    interface Chainable<Subject = unknown> {
      checkA11y(options?: ScanOptions): Chainable<Subject>;
    }
  }
}

export {};
