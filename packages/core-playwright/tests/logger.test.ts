// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import type { Logger as PinoLogger } from 'pino';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { asEngineLogger, createLogger } from '../src/logger.js';

const ENV_KEYS = ['NODE_ENV', 'VITEST', 'LOG_LEVEL'] as const;

describe('createLogger', () => {
  let saved: Record<string, string | undefined>;

  beforeEach(() => {
    saved = {};
    for (const key of ENV_KEYS) {
      saved[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });

  it('returns a pino logger exposing the engine logger shape', () => {
    const log = createLogger();
    expect(typeof log.info).toBe('function');
    expect(typeof log.warn).toBe('function');
    expect(typeof log.error).toBe('function');
    expect(typeof log.debug).toBe('function');
    expect(typeof log.child).toBe('function');
  });

  it('defaults to silent level when NODE_ENV is "test"', () => {
    process.env['NODE_ENV'] = 'test';
    const log = createLogger();
    expect(log.level).toBe('silent');
  });

  it('defaults to silent level when VITEST is "true"', () => {
    process.env['VITEST'] = 'true';
    const log = createLogger();
    expect(log.level).toBe('silent');
  });

  it('uses LOG_LEVEL when set and not in a test environment', () => {
    process.env['LOG_LEVEL'] = 'warn';
    const log = createLogger();
    expect(log.level).toBe('warn');
  });

  it('falls back to "info" when neither test-mode nor LOG_LEVEL is set', () => {
    const log = createLogger();
    expect(log.level).toBe('info');
  });

  it('lets an explicit opts.level override the environment-derived default', () => {
    process.env['NODE_ENV'] = 'test';
    const log = createLogger({ level: 'debug' });
    expect(log.level).toBe('debug');
  });

  it('forwards additional pino options', () => {
    const log = createLogger({ level: 'error', name: 'scanner' });
    expect(log.level).toBe('error');
    expect(log.bindings()['name']).toBe('scanner');
  });

  it('produces a child logger that inherits the configured level', () => {
    const log = createLogger({ level: 'warn' });
    const child = log.child({ scanId: 'abc' });
    expect(child.level).toBe('warn');
  });
});

describe('asEngineLogger', () => {
  it('returns the same instance it is given (identity pass-through)', () => {
    const pino = createLogger();
    const engine = asEngineLogger(pino);
    expect(engine).toBe(pino as unknown as typeof engine);
  });

  it('exposes the methods the engine Logger contract requires', () => {
    const engine = asEngineLogger(createLogger() as unknown as PinoLogger);
    expect(typeof engine.info).toBe('function');
    expect(typeof engine.warn).toBe('function');
    expect(typeof engine.error).toBe('function');
    expect(typeof engine.debug).toBe('function');
    expect(typeof engine.child).toBe('function');
  });
});
