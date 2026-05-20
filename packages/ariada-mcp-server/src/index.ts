// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

/**
 * Library entry — exposes the server class, transport dispatcher, and tool
 * handlers for direct embedding (tests, hosted-mode shims, alternative
 * transports).
 */

export { AriadaMcpServer } from './server.js';
export type { ServerInfo, ServerOptions, ToolDefinition } from './server.js';

export { McpServerError, ERROR_CODES } from './errors.js';
export type { ErrorCode, ErrorName } from './errors.js';

export {
  guardUrl,
  isLoopbackName,
  isPrivateIpv4,
  isPrivateIpv6,
  type GuardOptions,
} from './ssrf-guard.js';

export {
  runListRules,
  summariseRule,
  listRulesInputSchema,
  type ListRulesInput,
  type RuleSummary,
} from './tools/list-rules.js';

export {
  runExplainViolation,
  canonicalRuleId,
  explainViolationInputSchema,
  type ExplainViolationInput,
  type ExplanationResult,
  type ExplanationKnown,
  type ExplanationUnknown,
} from './tools/explain-violation.js';

export {
  runSuggestFix,
  suggestFixInputSchema,
  type SuggestFixInput,
  type SuggestFixResult,
  type FixConfidence,
} from './tools/suggest-fix.js';

export {
  runScan,
  scanInputSchema,
  type ScanInput,
  type ScanResult,
  type ScanFn,
  type RunScanOptions,
} from './tools/scan.js';

export {
  attachStdioTransport,
  handleStdioMessage,
  type JsonRpcMessage,
  type DispatchContext,
} from './transports/stdio.js';
