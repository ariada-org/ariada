// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Recovered from `dist/index.js` and `dist/index.d.ts`. The source this was
// built from was never committed; the compiled output is `tsc` with the types
// stripped, so the type-only re-exports come back from the declaration file and
// the value re-exports are the compiled ones. Checked with
// the rebuild check.

export {
  BrevoRecipeError,
  fetchBrevoCampaignHtml,
  normalizePublicBrevoUrl,
  scanBrevo,
  type BrevoScanInput,
  type BrevoScanOptions,
  type BrevoScanResult,
  type FetchLike,
} from './brevo.js';
export {
  CLI_SCAN_SCHEMA,
  CliScanParseError,
  SEVERITIES,
  flattenFindings,
  parseCliScan,
  type AriadaFinding,
  type AriadaReport,
  type CliScanEnvelope,
  type Severity,
} from './cli-scan.js';
export {
  ProcessBoundaryError,
  spawnProcess,
  type ProcessRequest,
  type ProcessResult,
  type ProcessRunner,
} from './process.js';
export {
  CORE_SCANNER_MODULE_ID,
  SCANNER_COMPAT_MODULE_ID,
  SCANNER_MODULE_ID,
  ScannerInvocationError,
  buildScannerProcessRequest,
  invokeScanner,
  loadAriadaScanner,
  loadPrivateTargetCoreScanner,
  type BrowserName,
  type InvokeScannerOptions,
  type LoadedScanner,
  type ScannerInvocation,
} from './scanner.js';
