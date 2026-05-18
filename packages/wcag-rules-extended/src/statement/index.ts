// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
/**
 * Accessibility-statement generator — re-export from `@ariada/statement-generator`.
 *
 * As of 2026-05-16 the statement generator lives in a standalone package,
 * `@ariada/statement-generator`. This module preserves the public API of
 * `@ariada/wcag-rules-extended` v0.1.0 for backwards compatibility.
 *
 * New consumers should depend on `@ariada/statement-generator` directly.
 */

export {
  generateStatement,
  STATEMENT_MESSAGES,
} from '@ariada/statement-generator';

export type {
  GeneratedStatement,
  GenerateStatementOptions,
  StatementJurisdiction,
  StatementConformance,
  StatementFormat,
  StatementMessages,
} from '@ariada/statement-generator';
