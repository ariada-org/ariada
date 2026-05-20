// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
// Maintainer: Alekszandr Bricskin (Agonist Development AB, Sweden, org.nr 559452-5726)
/**
 * Error class thrown by every adapter on input-validation failures or when
 * the underlying scanner errors. Callers detect this class via
 * `error.name === 'AriadaTestAdapterError'` or `error instanceof
 * AriadaTestAdapterError`.
 */

/**
 *
 */
export type AriadaTestAdapterErrorCode =
  | 'ERR_A11Y_TARGET_INVALID'
  | 'ERR_A11Y_SEVERITY_INVALID'
  | 'ERR_A11Y_LOCALE_UNSUPPORTED'
  | 'ERR_A11Y_TIMEOUT'
  | 'ERR_A11Y_TIMEOUT_RANGE'
  | 'ERR_A11Y_SCANNER_FAIL'
  | 'ERR_A11Y_PACK_INVALID'
  | 'ERR_A11Y_EXCLUDE_INVALID';

/**
 * Stable, programmatic error surface for callers (CI gates, IDE integrations,
 * other adapters wrapping these adapters). Carries `code` for `switch`-based
 * dispatch and an optional `cause` (preserved through `Error.cause`).
 */
export class AriadaTestAdapterError extends Error {
  public override readonly name = 'AriadaTestAdapterError';
  public readonly code: AriadaTestAdapterErrorCode;

  /**
   *
   */
  public constructor(
    code: AriadaTestAdapterErrorCode,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.code = code;
  }
}
