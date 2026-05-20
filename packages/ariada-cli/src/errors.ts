// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

/**
 * Structured error catalogue for the CLI. Each error has a stable machine code
 * and a human-readable message. Errors are emitted to stderr as single-line
 * JSON objects so log aggregators can parse them without splitting on stack
 * traces.
 */
export type CliErrorCode =
  | 'E_INVALID_URL'
  | 'E_INVALID_OPTION'
  | 'E_RULE_NOT_FOUND'
  | 'E_NAVIGATION_TIMEOUT'
  | 'E_NAVIGATION_FAILED'
  | 'E_BROWSER_LAUNCH'
  | 'E_BROWSER_CRASH'
  | 'E_OUTPUT_WRITE'
  | 'E_UNIMPLEMENTED'
  | 'E_INTERNAL';

/**
 *
 */
export interface StructuredError {
  level: 'error';
  code: CliErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

/**
 *
 */
export class CliError extends Error {
  public readonly code: CliErrorCode;
  public readonly details: Record<string, unknown>;

  /**
   *
   */
  public constructor(code: CliErrorCode, message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'CliError';
    this.code = code;
    this.details = details;
  }

  /**
   *
   */
  public toStructured(): StructuredError {
    return {
      level: 'error',
      code: this.code,
      message: this.message,
      details: this.details,
    };
  }
}

/**
 * Emit a structured error to stderr as single-line JSON. Never throws.
 */
export function emitError(
  err: CliError | Error | unknown,
  stream: NodeJS.WritableStream = process.stderr,
): void {
  let payload: StructuredError;
  if (err instanceof CliError) {
    payload = err.toStructured();
  } else if (err instanceof Error) {
    payload = {
      level: 'error',
      code: 'E_INTERNAL',
      message: err.message,
      details: { name: err.name },
    };
  } else {
    payload = {
      level: 'error',
      code: 'E_INTERNAL',
      message: String(err),
    };
  }
  stream.write(`${JSON.stringify(payload)}\n`);
}
