// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
/**
 * Runtime-agnostic logger contract used by the engine and analyzers.
 *
 * Intentionally compatible with the subset of `pino`'s API that the scanner
 * needs (`info`/`warn`/`error`/`debug`/`child`) so the Node adapter can pass a
 * pino logger straight in without an adapter shim. Browser adapters can wrap
 * `console.*` and satisfy the same shape.
 */
export interface Logger {
  info(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
  debug(...args: unknown[]): void;
  child(bindings: Record<string, unknown>): Logger;
}

/**
 * Console-backed logger — works in any JS runtime that exposes `console`.
 * Used by `core-browser` and as the engine's last-resort default. Node-side
 * production code should prefer the pino logger from `@ariada-org/core-playwright`.
 */
export function createConsoleLogger(bindings: Record<string, unknown> = {}): Logger {
  const fmt = (level: string, args: unknown[]): unknown[] => {
    if (Object.keys(bindings).length === 0) return args;
    return [{ level, ...bindings }, ...args];
  };
  return {
    info: (...a: unknown[]): void => console.info(...fmt('info', a)),
    warn: (...a: unknown[]): void => console.warn(...fmt('warn', a)),
    error: (...a: unknown[]): void => console.error(...fmt('error', a)),
    debug: (...a: unknown[]): void => console.debug(...fmt('debug', a)),
    child: (extra: Record<string, unknown>): Logger =>
      createConsoleLogger({ ...bindings, ...extra }),
  };
}

/**
 * No-op logger. Useful for tests and silent-mode runs without bringing in pino.
 */
export function createNullLogger(): Logger {
  const noop = (): void => undefined;
  const self: Logger = {
    info: noop,
    warn: noop,
    error: noop,
    debug: noop,
    child: (): Logger => self,
  };
  return self;
}
