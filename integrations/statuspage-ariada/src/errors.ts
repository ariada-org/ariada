// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

// Two kinds of refusal, kept apart because the caller does different things
// about them: one means the input was wrong, the other means the far end was.
// The command line turns that distinction into two different exit codes.

/** Options for a validation refusal. */
export interface ValidationErrorOptions {
  readonly field?: string;
  readonly cause?: unknown;
}

/** The input was wrong. Naming the field is the whole value of this over `Error`. */
export class ValidationError extends Error {
  readonly code = 'VALIDATION_ERROR';
  readonly field: string | undefined;

  /** @param options `field` is what to fix; `cause` is what noticed. */
  constructor(message: string, options: ValidationErrorOptions = {}) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = 'ValidationError';
    this.field = options.field;
  }
}

/** How the far end failed: badly, incomprehensibly, or not at all. */
export type ProviderErrorCode = 'HTTP_ERROR' | 'INVALID_RESPONSE' | 'TRANSPORT_ERROR';

/** Options for a provider refusal. */
export interface ProviderErrorOptions {
  readonly statusCode?: number;
  readonly cause?: unknown;
}

/** The status board failed. Nothing here is the caller's fault. */
export class ProviderError extends Error {
  readonly provider = 'atlassian-statuspage';
  readonly code: ProviderErrorCode;
  readonly statusCode: number | undefined;

  /** @param code which of the three ways it failed. */
  constructor(code: ProviderErrorCode, message: string, options: ProviderErrorOptions = {}) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = 'ProviderError';
    this.code = code;
    this.statusCode = options.statusCode;
  }
}
