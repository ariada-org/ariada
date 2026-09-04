// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

export { parseCliConfig, runCli, HELP_TEXT, type CliConfig, type CliDependencies } from './cli.js';
export {
  DEFAULT_STATUSPAGE_BASE_URL,
  parseStatuspageConfig,
  type Environment,
  type StatuspageConfig,
  type StatuspageConfigOverrides,
} from './config.js';
export { ProviderError, ValidationError, type ProviderErrorCode } from './errors.js';
export {
  FetchHttpTransport,
  type HttpRequest,
  type HttpResponse,
  type HttpTransport,
} from './http.js';
export {
  buildRegressionIncidentPayload,
  createStatusUpdatePlan,
  updateStatusComponent,
  type RegressionIncidentOptions,
  type StatuspageIncidentPayload,
  type StatusUpdatePlan,
  type StatusUpdatePlanOptions,
  type StatusUpdateResult,
  type UpdateStatusComponentOptions,
} from './integration.js';
export { classifyAriadaResult, mapAriadaStatusToComponentState } from './mapping.js';
export { parseAriadaCliJson, parseAriadaCliResult } from './parser.js';
export type {
  ComponentUpdateReceipt,
  ComponentUpdateRequest,
  StatusBoardProvider,
} from './provider.js';
export {
  AtlassianStatuspageProvider,
  type AtlassianStatuspageProviderOptions,
} from './statuspage.js';
export {
  ARIADA_CLI_SCHEMA,
  type AriadaCliResult,
  type AriadaImpactCounts,
  type AriadaStatus,
  type AriadaSummary,
  type StatusComponentState,
} from './types.js';
