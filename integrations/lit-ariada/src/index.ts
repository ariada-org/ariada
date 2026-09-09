// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Recovered from `dist/index.js` and `dist/index.d.ts`. The source this was
// built from was never committed; the compiled output is `tsc` with the types
// stripped, so the shapes come back from the declaration file and the body is
// the compiled one. Checked with
// `bash scripts/sverit-vosstanovlennoe.sh`.

export { LitAriadaError, type LitAriadaErrorCode } from './errors.js';
export { LIT_ARIADA_COMMAND, createLitAriadaPlugin, type LitAriadaPluginOptions, type LitAriadaWebTestRunnerPlugin, } from './plugin.js';
export { flattenAriadaFindings, parseCliScanV1 } from './result.js';
export { normalizeComponentSelector, normalizeLitFixtureUrl, scanLitFixture, } from './scanner.js';
export { ARIADA_CLI_SCAN_SCHEMA, ARIADA_SEVERITIES, type AriadaFinding, type AriadaImpactCounts, type AriadaReport, type AriadaScanExitCode, type AriadaSeverity, type CliScanV1, type LitAriadaCommandPayload, type LitBrowser, type LitScanOptions, type LitScanResult, } from './types.js';
