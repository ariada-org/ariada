// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
// Maintainer: Alexander Brichkin (Agonist Development AB, Sweden, org.nr 559452-5726)
/**
 * Single source of truth for violation formatting. Every adapter — Jest,
 * Vitest, Mocha+Chai, Playwright, Cypress — pipes its violations through
 * `formatViolation` so the byte-for-byte output is identical across the
 * test pyramid (modulo framework-native prefix prose).
 */

import { SEVERITY_ORDER, type Impact, type Violation } from './types.js';

/**
 * Format a single violation as a single line. Shape:
 *
 *   `WCAG <sc> (<ruleId>) [<impact>]: <selector> — <message>`
 *
 * `<sc>` is the first WCAG SC reference; remaining SCs are appended in
 * parentheses if more than one was declared.
 */
export function formatViolation(v: Violation): string {
  const firstSc = v.wcag[0] ?? 'unknown';
  const extraSc = v.wcag.length > 1 ? ` (+${v.wcag.slice(1).join(', ')})` : '';
  return `WCAG ${firstSc}${extraSc} (${v.ruleId}) [${v.impact}]: ${v.selector} — ${v.message}`;
}

/**
 * Format a complete violation list into a multi-line block. Empty input
 * returns an empty string so the caller can compose its own «no violations»
 * prefix.
 */
export function formatViolations(violations: readonly Violation[]): string {
  return violations.map(formatViolation).join('\n');
}

/**
 * Filter a violation list down to entries at or above `threshold` per the
 * canonical severity ladder.
 */
export function filterBySeverity(
  violations: readonly Violation[],
  threshold: Impact,
): readonly Violation[] {
  const thresholdRank = SEVERITY_ORDER.indexOf(threshold);
  return violations.filter((v) => SEVERITY_ORDER.indexOf(v.impact) >= thresholdRank);
}
