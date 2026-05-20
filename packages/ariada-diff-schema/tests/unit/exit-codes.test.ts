// SPDX-License-Identifier: EUPL-1.2
import { describe, it, expect } from 'vitest';

import {
  EXIT_AUTH_ERROR,
  EXIT_CODE_LABELS,
  EXIT_CONFIG_ERROR,
  EXIT_GATE_FAIL,
  EXIT_GATE_PASS,
  EXIT_INTERNAL_ERROR,
  EXIT_NETWORK_ERROR,
  EXIT_RATE_LIMITED,
  exitCodeFromLabel,
} from '../../src/exit-codes.js';

describe('exit-codes', () => {
  it('matches the documented exit-code table', () => {
    expect(EXIT_GATE_PASS).toBe(0);
    expect(EXIT_GATE_FAIL).toBe(1);
    expect(EXIT_CONFIG_ERROR).toBe(2);
    expect(EXIT_NETWORK_ERROR).toBe(3);
    expect(EXIT_AUTH_ERROR).toBe(4);
    expect(EXIT_RATE_LIMITED).toBe(5);
    expect(EXIT_INTERNAL_ERROR).toBe(10);
  });

  it('exposes labels for every code', () => {
    expect(EXIT_CODE_LABELS[EXIT_GATE_PASS]).toBe('gate-pass');
    expect(EXIT_CODE_LABELS[EXIT_GATE_FAIL]).toBe('gate-fail');
    expect(EXIT_CODE_LABELS[EXIT_CONFIG_ERROR]).toBe('config-error');
    expect(EXIT_CODE_LABELS[EXIT_NETWORK_ERROR]).toBe('network-error');
    expect(EXIT_CODE_LABELS[EXIT_AUTH_ERROR]).toBe('auth-error');
    expect(EXIT_CODE_LABELS[EXIT_RATE_LIMITED]).toBe('rate-limited');
    expect(EXIT_CODE_LABELS[EXIT_INTERNAL_ERROR]).toBe('internal-error');
  });

  it('reverses label → code', () => {
    expect(exitCodeFromLabel('gate-pass')).toBe(EXIT_GATE_PASS);
    expect(exitCodeFromLabel('gate-fail')).toBe(EXIT_GATE_FAIL);
    expect(exitCodeFromLabel('internal-error')).toBe(EXIT_INTERNAL_ERROR);
  });

  it('returns undefined for unknown label', () => {
    expect(exitCodeFromLabel('unknown')).toBeUndefined();
  });
});
