// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { describe, it, expect, beforeEach } from 'vitest';

import { setBodyFromFragment, resetBody } from '../../test-utils.js';

import { check } from './seat-selection-has-accessible-name.js';

describe('transport/seat-selection-has-accessible-name — check', () => {
  beforeEach(() => resetBody());

  const inSeatMap = (inner: string, selector: string) =>
    setBodyFromFragment(`<div data-seat-map>${inner}</div>`).querySelector(selector)!;

  it('PASSES a button with seat text "12A"', () => {
    expect(check(inSeatMap('<button>12A</button>', 'button'))).toBe(true);
  });

  it('PASSES a button with aria-label="Seat 12A"', () => {
    expect(check(inSeatMap('<button aria-label="Seat 12A"></button>', 'button'))).toBe(true);
  });

  it('PASSES a checkbox input with aria-label', () => {
    expect(
      check(inSeatMap('<input type="checkbox" aria-label="Seat 12A">', 'input')),
    ).toBe(true);
  });

  it('PASSES a role="button" with text', () => {
    expect(check(inSeatMap('<div role="button">7C</div>', '[role="button"]'))).toBe(true);
  });

  it('FAILS an empty button', () => {
    expect(check(inSeatMap('<button></button>', 'button'))).toBe(false);
  });

  it('FAILS a radio input with no name', () => {
    expect(check(inSeatMap('<input type="radio">', 'input'))).toBe(false);
  });

  it('FAILS a button whose only name is whitespace', () => {
    expect(check(inSeatMap('<button>   </button>', 'button'))).toBe(false);
  });

  // Edge cases

  it('SKIPS a button outside any seat map', () => {
    const node = setBodyFromFragment('<div><button></button></div>').querySelector('button')!;
    expect(check(node)).toBe(true);
  });

  it('SKIPS a non-checkbox/radio input inside a seat map', () => {
    expect(check(inSeatMap('<input type="text">', 'input'))).toBe(true);
  });
});
