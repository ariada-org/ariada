// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

import type { AriadaScanOptions, AriadaScanResult, AriadaScanTaskPayload } from './types.js';

interface CypressLogApi {
  log(options: { name: string; message: string; consoleProps?: () => Record<string, unknown> }): void;
}

interface CypressCommandsApi {
  add(
    name: string,
    options: { prevSubject: 'optional' },
    fn: (subject: unknown, options?: AriadaScanOptions) => unknown,
  ): void;
}

interface CypressGlobal extends CypressLogApi {
  Commands: CypressCommandsApi;
}

interface CyChainable {
  url(options?: { log?: boolean }): { then(fn: (value: string) => unknown): unknown };
  task(
    event: 'ariada:scan',
    payload: AriadaScanTaskPayload,
    options?: { timeout?: number; log?: boolean },
  ): { then(fn: (result: AriadaScanResult) => unknown): unknown };
}

/**
 * Registers `cy.ariadaScan(options?)`.
 */
export function registerAriadaCommand(
  cypressGlobal?: CypressGlobal,
  cyGlobal?: CyChainable,
): void {
  const Cypress =
    cypressGlobal ?? ((globalThis as { Cypress?: CypressGlobal }).Cypress as CypressGlobal | undefined);
  const cy = cyGlobal ?? ((globalThis as { cy?: CyChainable }).cy as CyChainable | undefined);
  if (!Cypress || !cy) return;

  Cypress.Commands.add(
    'ariadaScan',
    { prevSubject: 'optional' },
    (subject: unknown, options: AriadaScanOptions = {}) => {
      return cy.url({ log: false }).then((url) => {
        return cy
          .task(
            'ariada:scan',
            { url, options },
            { timeout: options.taskTimeoutMs ?? 120_000, log: false },
          )
          .then((result) => {
            Cypress.log({
              name: 'ariadaScan',
              message:
                result.blockingCount > 0
                  ? `${result.blockingCount} blocking violation(s)`
                  : `0 blocking violations (${result.mode})`,
              consoleProps: () => ({ result }),
            });

            if (options.logOnly !== true && options.failOnViolation !== false && result.blockingCount > 0) {
              throw new Error(result.message);
            }
            return subject ?? result;
          });
      });
    },
  );
}
