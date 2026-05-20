// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { describe, it, expect } from 'vitest';

import {
  EXIT_OK,
  EXIT_VIOLATIONS,
  EXIT_INVALID_ARGS,
  EXIT_RUNTIME_ERROR,
  EXIT_UNIMPLEMENTED,
  EXIT_PRECHECK,
  EXIT_CODE_LABELS,
} from '../src/exit-codes.js';

describe('exit-codes', () => {
  it('exposes stable numeric values per task brief', () => {
    expect(EXIT_OK).toBe(0);
    expect(EXIT_VIOLATIONS).toBe(1);
    expect(EXIT_INVALID_ARGS).toBe(2);
    expect(EXIT_RUNTIME_ERROR).toBe(3);
    expect(EXIT_UNIMPLEMENTED).toBe(4);
    expect(EXIT_PRECHECK).toBe(5);
  });

  it('provides a label for every code', () => {
    expect(EXIT_CODE_LABELS[EXIT_OK]).toBe('ok');
    expect(EXIT_CODE_LABELS[EXIT_VIOLATIONS]).toBe('violations');
    expect(EXIT_CODE_LABELS[EXIT_INVALID_ARGS]).toBe('invalid-args');
    expect(EXIT_CODE_LABELS[EXIT_RUNTIME_ERROR]).toBe('runtime-error');
    expect(EXIT_CODE_LABELS[EXIT_UNIMPLEMENTED]).toBe('unimplemented');
    expect(EXIT_CODE_LABELS[EXIT_PRECHECK]).toBe('precheck-failed');
  });
});
