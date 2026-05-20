// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
// Maintainer: Alekszandr Bricskin (Agonist Development AB, Sweden, org.nr 559452-5726)
/**
 * Cypress custom command body for `cy.checkA11y(options?)`. Implemented as a
 * child command with `prevSubject: 'optional'` so the chain
 * `cy.visit('/').checkA11y()` works ergonomically (matches the
 * `cy.injectAxe` precedent).
 *
 * Implementation strategy: in a Cypress run the test runner already controls
 * the document under test inside an iframe. We grab `cy.url()` and feed it
 * through `assertAccessible`. For component-test mode where there is no
 * navigable URL, callers can pass `{ html: cy.$$('body').html() }` via a
 * custom command on top — left as a v0.2 escape hatch.
 */

import { assertAccessible } from '../internal/assert-accessible.js';
import type { ScanOptions } from '../internal/types.js';

/**
 * Minimal structural shape of the Cypress `cy` chainable we touch.
 */
interface CyChainable {
  url(): { then(fn: (value: string) => unknown): unknown };
  then(fn: (subject: unknown) => unknown): unknown;
  log(opts: { name: string; message: string }): unknown;
}

interface CypressCommandsApi {
  add(
    name: string,
    options: { prevSubject: 'optional' },
    fn: (subject: unknown, options?: ScanOptions) => unknown,
  ): void;
}

interface CypressGlobal {
  Commands: CypressCommandsApi;
}

/**
 * Register `cy.checkA11y(options?)` on the supplied Cypress global. Returns
 * silently if Cypress is not present (e.g. import-time pre-check in CI).
 */
export function registerCypressCommand(
  cypressGlobal?: CypressGlobal,
  cyGlobal?: CyChainable,
): void {
  const Cypress =
    cypressGlobal ?? ((globalThis as { Cypress?: CypressGlobal }).Cypress as CypressGlobal | undefined);
  const cy = cyGlobal ?? ((globalThis as { cy?: CyChainable }).cy as CyChainable | undefined);
  if (!Cypress || !cy) return;

  Cypress.Commands.add(
    'checkA11y',
    { prevSubject: 'optional' },
    (subject: unknown, options?: ScanOptions) => {
      return cy.url().then(async (url: string) => {
        const target: unknown = subject ?? url;
        const outcome = await assertAccessible(
          target as Parameters<typeof assertAccessible>[0],
          options,
        );
        cy.log({
          name: 'checkA11y',
          message: outcome.pass
            ? `accessibility OK (${outcome.result.violations.length} non-blocking)`
            : `${outcome.failingViolations.length} violation(s) at or above threshold`,
        });
        if (!outcome.pass) {
          throw new Error(outcome.message);
        }
        return subject ?? outcome.result;
      });
    },
  );
}
