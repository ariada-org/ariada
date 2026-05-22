// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

/**
 * Stable CLI exit codes.
 *
 * Per task brief (the brief is the explicit source of truth for the v0.1 scaffold):
 *
 *   0 — OK, no violations at or above severity threshold
 *   1 — Violations found
 *   2 — Invalid arguments (parser rejected the invocation)
 *   3 — Runtime error (network failure, browser crash, timeout, IO)
 *   4 — Unimplemented subcommand or feature (stub)
 *   5 — License / pre-check failure (reserved for future patent-binding guard)
 */
export const EXIT_OK = 0;
export const EXIT_VIOLATIONS = 1;
export const EXIT_INVALID_ARGS = 2;
export const EXIT_RUNTIME_ERROR = 3;
export const EXIT_UNIMPLEMENTED = 4;
export const EXIT_PRECHECK = 5;

/**
 *
 */
export type ExitCode =
  | typeof EXIT_OK
  | typeof EXIT_VIOLATIONS
  | typeof EXIT_INVALID_ARGS
  | typeof EXIT_RUNTIME_ERROR
  | typeof EXIT_UNIMPLEMENTED
  | typeof EXIT_PRECHECK;

export const EXIT_CODE_LABELS: Record<ExitCode, string> = {
  [EXIT_OK]: 'ok',
  [EXIT_VIOLATIONS]: 'violations',
  [EXIT_INVALID_ARGS]: 'invalid-args',
  [EXIT_RUNTIME_ERROR]: 'runtime-error',
  [EXIT_UNIMPLEMENTED]: 'unimplemented',
  [EXIT_PRECHECK]: 'precheck-failed',
};
