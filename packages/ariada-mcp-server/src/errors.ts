// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

/**
 * JSON-RPC + MCP error codes used by the server. Values follow the JSON-RPC
 * 2.0 reserved range (-32700..-32600) for protocol errors and a custom range
 * (-32000..-32099) for application errors documented in the package README.
 */
export const ERROR_CODES = {
  ParseError: -32700,
  InvalidRequest: -32600,
  MethodNotFound: -32601,
  InvalidParams: -32602,
  InternalError: -32603,
  SsrfRefused: -32000,
  NavigationTimeout: -32001,
  NavigationFailed: -32002,
  BrowserLaunchFailed: -32003,
  RuleNotFound: -32004,
  RateLimited: -32005,
} as const;

/** Numeric JSON-RPC error code, one of the values in {@link ERROR_CODES}. */
export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

/** Symbolic name of an error in {@link ERROR_CODES}. */
export type ErrorName = keyof typeof ERROR_CODES;

/**
 * Application-level error thrown by tool handlers. The transport layer maps
 * this to a JSON-RPC error response with structured `data`.
 */
export class McpServerError extends Error {
  public readonly code: ErrorCode;
  public readonly data: Record<string, unknown>;

  /**
   * Construct an error tagged with one of the symbolic names in {@link ERROR_CODES}.
   *
   * @param name - Symbolic error name; mapped to a numeric JSON-RPC code.
   * @param message - Human-readable message included in the response.
   * @param data - Optional structured payload included in `error.data`.
   */
  constructor(name: ErrorName, message: string, data: Record<string, unknown> = {}) {
    super(message);
    this.name = 'McpServerError';
    this.code = ERROR_CODES[name];
    this.data = data;
  }
}
