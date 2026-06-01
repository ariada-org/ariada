// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { describe, it, expect, beforeEach } from 'vitest';

import { setBodyFromFragment, resetBody } from '../../test-utils.js';

import { check } from './booking-timeout-has-warning.js';

describe('transport/booking-timeout-has-warning — check', () => {
  beforeEach(() => resetBody());

  it('PASSES aria-describedby pointing to a non-empty warning', () => {
    const document = setBodyFromFragment(`
      <div data-booking-timeout aria-describedby="warn">04:59</div>
      <span id="warn">Your seats are held for 5 minutes. Select "extend" to add more time.</span>
    `);
    expect(check(document.querySelector('[data-booking-timeout]')!)).toBe(true);
  });

  it('PASSES a data-timeout-warning hook present', () => {
    const document = setBodyFromFragment(
      `<div data-booking-timeout data-timeout-warning>04:59</div>`,
    );
    expect(check(document.querySelector('[data-booking-timeout]')!)).toBe(true);
  });

  it('FAILS a bare data-booking-timeout', () => {
    const document = setBodyFromFragment(`<div data-booking-timeout>04:59</div>`);
    expect(check(document.querySelector('[data-booking-timeout]')!)).toBe(false);
  });

  it('FAILS aria-describedby pointing to a missing id', () => {
    const document = setBodyFromFragment(
      `<div data-booking-timeout aria-describedby="nonexistent">04:59</div>`,
    );
    expect(check(document.querySelector('[data-booking-timeout]')!)).toBe(false);
  });

  it('FAILS aria-describedby pointing to an empty element', () => {
    const document = setBodyFromFragment(`
      <div data-booking-timeout aria-describedby="warn">04:59</div>
      <span id="warn">   </span>
    `);
    expect(check(document.querySelector('[data-booking-timeout]')!)).toBe(false);
  });

  // Edge cases

  it('SKIPS an element without data-booking-timeout', () => {
    const document = setBodyFromFragment(`<div aria-describedby="warn">04:59</div>`);
    expect(check(document.querySelector('div')!)).toBe(true);
  });

  it('PASSES aria-describedby with multiple ids where one is non-empty', () => {
    const document = setBodyFromFragment(`
      <div data-booking-timeout aria-describedby="empty warn">04:59</div>
      <span id="empty"></span>
      <span id="warn">Seats held for 5 minutes.</span>
    `);
    expect(check(document.querySelector('[data-booking-timeout]')!)).toBe(true);
  });

  it('PASSES data-timeout-warning even when aria-describedby is broken', () => {
    const document = setBodyFromFragment(
      `<div data-booking-timeout data-timeout-warning aria-describedby="nonexistent">04:59</div>`,
    );
    expect(check(document.querySelector('[data-booking-timeout]')!)).toBe(true);
  });
});
