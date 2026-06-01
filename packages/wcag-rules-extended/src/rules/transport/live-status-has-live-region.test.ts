// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { describe, it, expect, beforeEach } from 'vitest';

import { setBodyFromFragment, resetBody } from '../../test-utils.js';

import { check } from './live-status-has-live-region.js';

describe('transport/live-status-has-live-region — check', () => {
  beforeEach(() => resetBody());

  const board = (attributes: string) =>
    setBodyFromFragment(`<div data-live-status ${attributes}>Delayed 5 min</div>`).querySelector(
      'div',
    )!;

  it('PASSES aria-live="polite"', () => {
    expect(check(board('aria-live="polite"'))).toBe(true);
  });

  it('PASSES aria-live="assertive"', () => {
    expect(check(board('aria-live="assertive"'))).toBe(true);
  });

  it('PASSES role="status"', () => {
    expect(check(board('role="status"'))).toBe(true);
  });

  it('PASSES role="alert"', () => {
    expect(check(board('role="alert"'))).toBe(true);
  });

  it('FAILS a bare data-live-status with no live-region semantics', () => {
    expect(check(board(''))).toBe(false);
  });

  it('FAILS aria-live="off" (off does not announce)', () => {
    expect(check(board('aria-live="off"'))).toBe(false);
  });

  // Edge cases

  it('SKIPS an element without data-live-status', () => {
    const node = setBodyFromFragment('<div aria-live="off">static</div>').querySelector('div')!;
    expect(check(node)).toBe(true);
  });

  it('is case-insensitive about role values', () => {
    expect(check(board('role="STATUS"'))).toBe(true);
  });

  it('is case-insensitive about aria-live values', () => {
    expect(check(board('aria-live="Polite"'))).toBe(true);
  });
});
