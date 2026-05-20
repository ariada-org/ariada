// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
// Maintainer: Alekszandr Bricskin (Agonist Development AB, Sweden, org.nr 559452-5726)
/**
 * Cypress entry. Side-effect import: registers `cy.checkA11y` on the active
 * Cypress global the first time this module loads.
 *
 * Usage in `cypress/support/e2e.ts`:
 *
 * ```ts
 * import '@ariada/test-adapters/cypress';
 * // Then in any spec:
 * cy.visit('/').checkA11y();
 * ```
 */

import { registerCypressCommand } from './command.js';
import './types.js';

registerCypressCommand();

export { registerCypressCommand } from './command.js';
