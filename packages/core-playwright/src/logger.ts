// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import type { Logger } from '@ariada-org/core-engine';
import pino, { type Logger as PinoLogger, type LoggerOptions } from 'pino';

/**
 * Pino-backed logger. Exposed both as the runtime-agnostic `Logger` interface
 * (so the engine treats it like any other logger) and as the raw pino instance
 * for callers that want pino-specific features.
 */
export function createLogger(opts?: LoggerOptions): PinoLogger {
  const isTest = process.env['NODE_ENV'] === 'test' || process.env['VITEST'] === 'true';
  const level = opts?.level ?? (isTest ? 'silent' : (process.env['LOG_LEVEL'] ?? 'info'));
  return pino({ level, ...opts });
}

/**
 * Wraps a pino logger so callers that only need the engine `Logger` shape
 * don't pin themselves to pino's full API.
 */
export function asEngineLogger(p: PinoLogger): Logger {
  return p;
}
