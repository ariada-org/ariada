// SPDX-License-Identifier: EUPL-1.2
/**
 * Accessibility-statement generator — public entry point.
 *
 * @see ./README.md
 */

export {
  generateStatement,
  type GeneratedStatement,
  type GenerateStatementOptions,
  type StatementJurisdiction,
  type StatementConformance,
  type StatementFormat,
} from './generate.js';

export { STATEMENT_MESSAGES, type StatementMessages } from './i18n.js';

export type { Locale } from './types.js';