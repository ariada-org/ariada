// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

import { registerAriadaCommand } from './commands.js';
import type { AriadaScanOptions, AriadaScanResult } from './types.js';

registerAriadaCommand();

export { registerAriadaCommand } from './commands.js';
export type {
  AriadaBrowser,
  AriadaFinding,
  AriadaScanMode,
  AriadaScanOptions,
  AriadaScanResult,
  AriadaScanSummary,
  AriadaScanTaskPayload,
  AriadaSeverity,
} from './types.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    interface Chainable<Subject = any> {
      ariadaScan(options?: AriadaScanOptions): Chainable<Subject | AriadaScanResult>;
    }
  }
}
