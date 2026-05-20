// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { describe, expect, it } from 'vitest';

import { AriadaTestAdapterError } from '../../src/internal/error.js';

describe('AriadaTestAdapterError', () => {
  it('sets name to AriadaTestAdapterError', () => {
    const err = new AriadaTestAdapterError('ERR_A11Y_TIMEOUT', 'timeout');
    expect(err.name).toBe('AriadaTestAdapterError');
  });

  it('exposes the code property', () => {
    const err = new AriadaTestAdapterError('ERR_A11Y_TARGET_INVALID', 'bad target');
    expect(err.code).toBe('ERR_A11Y_TARGET_INVALID');
  });

  it('extends the native Error', () => {
    const err = new AriadaTestAdapterError('ERR_A11Y_SCANNER_FAIL', 'boom');
    expect(err).toBeInstanceOf(Error);
  });

  it('preserves the message', () => {
    const err = new AriadaTestAdapterError('ERR_A11Y_TIMEOUT', 'exceeded 30s');
    expect(err.message).toBe('exceeded 30s');
  });

  it('attaches the cause via Error.cause', () => {
    const root = new Error('root cause');
    const err = new AriadaTestAdapterError('ERR_A11Y_SCANNER_FAIL', 'wrapped', { cause: root });
    expect(err.cause).toBe(root);
  });

  it('is throwable + catchable via instanceof', () => {
    try {
      throw new AriadaTestAdapterError('ERR_A11Y_PACK_INVALID', 'bad pack');
    } catch (err) {
      expect(err).toBeInstanceOf(AriadaTestAdapterError);
    }
  });
});
