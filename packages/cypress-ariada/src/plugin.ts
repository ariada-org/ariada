// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

import { runAriadaScan, type RunAriadaScanDependencies } from './scan-adapter.js';
import type { AriadaScanOptions, AriadaScanTaskPayload } from './types.js';

type CypressEventRegistrar = (event: 'task', handlers: Record<string, unknown>) => void;

export interface AriadaNodeEventsOptions extends AriadaScanOptions, RunAriadaScanDependencies {}

/**
 * Registers the Node-side task consumed by `cy.ariadaScan()`.
 */
export function setupAriadaNodeEvents<TConfig>(
  on: CypressEventRegistrar,
  config: TConfig,
  defaults: AriadaNodeEventsOptions = {},
): TConfig {
  on('task', {
    async 'ariada:scan'(payload: AriadaScanTaskPayload) {
      if (!payload?.url) {
        throw new Error('ariada:scan task requires a URL');
      }
      const { runScan, ...scanDefaults } = defaults;
      return runAriadaScan(
        payload.url,
        {
          ...scanDefaults,
          ...payload.options,
        },
        runScan ? { runScan } : {},
      );
    },
  });
  return config;
}
