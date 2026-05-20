// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
// Maintainer: Alekszandr Bricskin (Agonist Development AB, Sweden, org.nr 559452-5726)
/**
 * Public re-exports for advanced consumers writing their own framework
 * integration on top of the shared scanner glue.
 */

export { AriadaTestAdapterError, type AriadaTestAdapterErrorCode } from './error.js';
export { formatViolation, formatViolations, filterBySeverity } from './format-violation.js';
export { normaliseTarget, type RawScanTarget } from './normalise-target.js';
export { runScan, setScanner, projectScanResult, type ScannerImpl } from './run-scan.js';
export { validateOptions, type NormalisedScanOptions } from './validate-options.js';
export { assertAccessible, type AssertionOutcome } from './assert-accessible.js';
export {
  ALL_RULE_PACKS,
  DEFAULT_SEVERITY,
  DEFAULT_TIMEOUT_MS,
  SEVERITY_ORDER,
  SUPPORTED_LOCALES,
  type Impact,
  type Locale,
  type PageLike,
  type RulePackName,
  type ScanOptions,
  type ScanResult,
  type ScanTarget,
  type ScanTargetKind,
  type Violation,
  type WcagSuccessCriterion,
} from './types.js';
