// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
// Maintainer: Alekszandr Bricskin (Agonist Development AB, Sweden, org.nr 559452-5726)
/**
 * Framework-agnostic assertion core. Every adapter calls `assertAccessible`
 * with a raw target and options, gets back a structured result, and frames
 * that result as the framework-native pass/fail value.
 */

import { filterBySeverity, formatViolations } from './format-violation.js';
import { normaliseTarget, type RawScanTarget } from './normalise-target.js';
import { runScan } from './run-scan.js';
import type { ScanOptions, ScanResult } from './types.js';
import { validateOptions } from './validate-options.js';

/**
 * Outcome of an accessibility assertion. Adapters consume this directly to
 * produce framework-native results without re-running the scanner.
 */
export interface AssertionOutcome {
  /** True iff zero violations met or exceeded the severity threshold. */
  readonly pass: boolean;
  /** Raw, reusable scan result for downstream assertions. */
  readonly result: ScanResult;
  /** Filtered list of violations that triggered the failure (empty on pass). */
  readonly failingViolations: ScanResult['violations'];
  /** Pre-formatted multi-line message body suitable for matcher output. */
  readonly message: string;
}

/**
 * Run a scan and evaluate the result against the severity threshold.
 *
 * @param target - any accepted target shape (`PageLike`, URL string, HTML
 *   string, `{ html }`, `{ url }`, or a previously-computed `ScanResult` to
 *   re-evaluate without re-scanning).
 * @param input - caller-supplied options
 * @returns structured assertion outcome
 */
export async function assertAccessible(
  target: RawScanTarget | ScanResult,
  input?: ScanOptions,
): Promise<AssertionOutcome> {
  const options = validateOptions(input);

  const result = isScanResult(target) ? target : await runScan(normaliseTarget(target), options);

  const failing = filterBySeverity(result.violations, options.severity);
  const pass = failing.length === 0;
  const message = pass
    ? `Expected page to have accessibility violations at or above '${options.severity}'; none found (${result.violations.length} total violations).`
    : `Expected no accessibility violations at or above '${options.severity}' — found ${failing.length}:\n${formatViolations(failing)}`;

  return {
    pass,
    result,
    failingViolations: failing,
    message,
  };
}

/**
 * Structural guard distinguishing a pre-computed `ScanResult` from a raw
 * target. Lets `assertAccessible` accept either shape without an explicit
 * `kind` discriminator on the caller side (reusable result entry point).
 */
function isScanResult(value: unknown): value is ScanResult {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<ScanResult>;
  return (
    Array.isArray(candidate.violations) &&
    typeof candidate.timestamp === 'string' &&
    typeof candidate.durationMs === 'number' &&
    typeof candidate.target === 'object'
  );
}
