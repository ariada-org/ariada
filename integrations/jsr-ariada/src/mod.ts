// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
/**
 *
 */
export interface AriadaJsrUsage {
  readonly install: string;
  readonly scan: string;
}

/**
 *
 */
export function usage(): AriadaJsrUsage {
  return {
    install: 'deno add jsr:@ariada-org/ariada',
    scan: 'Use the npm CLI package @ariada-org/cli for Node-based scanning.',
  };
}
