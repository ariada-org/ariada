// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

/**
 * Library entry — the CLI is also importable as a Node module for embedding
 * in scripts that want to invoke ariada subcommands programmatically without
 * spawning a child process.
 */
export { run, buildProgram, type RunOptions } from './parser.js';
export {
  EXIT_OK,
  EXIT_VIOLATIONS,
  EXIT_INVALID_ARGS,
  EXIT_RUNTIME_ERROR,
  EXIT_UNIMPLEMENTED,
  EXIT_PRECHECK,
  EXIT_CODE_LABELS,
  type ExitCode,
} from './exit-codes.js';
export { CliError, emitError, type CliErrorCode, type StructuredError } from './errors.js';
export { runScan, type ScanOptions } from './subcommands/scan.js';
export { runListRules, type ListRulesOptions } from './subcommands/list-rules.js';
export { runVersion } from './subcommands/version.js';
export { runGenerateStatement } from './subcommands/generate-statement.js';
export { runEstimatePenalty } from './subcommands/estimate-penalty.js';
export {
  runDiffClassify,
  runDiffGate,
  runDiffInspect,
  runDiffExplain,
  runDiffReplay,
  runDiffExempt,
  type DiffClassifyOptions,
  type DiffGateOptions,
  type DiffInspectOptions,
  type DiffExplainOptions,
  type DiffReplayOptions,
  type DiffExemptOptions,
} from './commands/diff/index.js';
