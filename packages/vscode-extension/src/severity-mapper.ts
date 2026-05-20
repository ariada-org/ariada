// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

import type { RuleSeverity } from './rules.js';

/**
 * VS Code's DiagnosticSeverity enum mirrored as plain numeric constants so
 * this module is testable without importing `vscode`. Values match the
 * upstream `vscode.DiagnosticSeverity`:
 *
 *   Error = 0, Warning = 1, Information = 2, Hint = 3.
 */
export const DIAGNOSTIC_SEVERITY = {
  Error: 0,
  Warning: 1,
  Information: 2,
  Hint: 3,
} as const;

/**
 *
 */
export type DiagnosticSeverityValue =
  (typeof DIAGNOSTIC_SEVERITY)[keyof typeof DIAGNOSTIC_SEVERITY];

/**
 *
 */
export function mapSeverity(ruleSeverity: RuleSeverity): DiagnosticSeverityValue {
  switch (ruleSeverity) {
    case 'critical':
      return DIAGNOSTIC_SEVERITY.Error;
    case 'serious':
      return DIAGNOSTIC_SEVERITY.Warning;
    case 'moderate':
      return DIAGNOSTIC_SEVERITY.Information;
    case 'minor':
      return DIAGNOSTIC_SEVERITY.Hint;
  }
}
