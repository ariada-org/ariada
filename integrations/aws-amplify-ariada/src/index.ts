// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Recovered from `dist/index.js` and `dist/index.d.ts`. The source this was
// built from was never committed; the compiled output is `tsc` with the types
// stripped, so the type-only re-exports come back from the declaration file and
// the value re-exports are the compiled ones. Checked with
// the rebuild check.

export { HELP_TEXT, loadConfig, parseArguments, parseConfigObject } from "./config.js";
export { decideGate } from "./gate.js";
export { runAmplifyIntegration, type IntegrationDependencies } from "./integration.js";
export { parseAriadaScanJson } from "./output.js";
export { SubprocessAriadaRunner } from "./runner.js";
export { serveDirectory } from "./static-server.js";
export { resolveTarget } from "./target.js";
export {
  ARIADA_CLI_PACKAGE,
  ARIADA_CLI_VERSION,
  type ActiveTarget,
  type AriadaImpactCounts,
  type AriadaInvocationOptions,
  type AriadaRunner,
  type AriadaRunnerResult,
  type AriadaScanJson,
  type BrowserName,
  type DecisionOutcome,
  type GateDecision,
  type GateMode,
  type IntegrationConfig,
  type IntegrationResult,
  type ResolvedTarget,
  type SeverityThreshold,
  type StaticServerFactory,
  type StaticServerHandle,
} from "./types.js";
