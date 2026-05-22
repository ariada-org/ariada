// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { describe, it, expect, beforeEach } from 'vitest';

import { setBodyFromFragment, resetBody } from '../../test-utils.js';

import { check } from './cart-quantity-input-label.js';

describe('checkout/cart-quantity-input-label — check', () => {
  beforeEach(() => resetBody());

  it('FAILS when label is generic "Qty"', () => {
    const document = setBodyFromFragment(`
      <label for="q1">Qty</label>
      <input type="number" id="q1" name="qty-1" value="1">
    `);
    expect(check(document.querySelector('#q1')!)).toBe(false);
  });

  it('FAILS when quantity input has no label', () => {
    const document = setBodyFromFragment(
      `<input type="number" id="q1" class="quantity-input" value="1">`,
    );
    expect(check(document.querySelector('#q1')!)).toBe(false);
  });

  it('PASSES when aria-label distinguishes product', () => {
    const document = setBodyFromFragment(
      `<input type="number" name="qty" aria-label="Quantity of Blue T-shirt" value="2">`,
    );
    expect(check(document.querySelector('input')!)).toBe(true);
  });

  it('PASSES when aria-labelledby references product name', () => {
    const document = setBodyFromFragment(`
      <h4 id="prod-7">Blue T-shirt</h4>
      <input type="number" name="qty-7" aria-labelledby="prod-7" value="1">
    `);
    expect(check(document.querySelector('input')!)).toBe(true);
  });

  it('FAILS for Swedish generic "Antal"', () => {
    const document = setBodyFromFragment(`
      <label for="q1">Antal</label>
      <input type="number" id="q1" name="antal-1" value="1">
    `);
    expect(check(document.querySelector('#q1')!)).toBe(false);
  });

  it('SKIPS non-quantity inputs', () => {
    const document = setBodyFromFragment(`<input type="text" name="search" value="">`);
    expect(check(document.querySelector('input')!)).toBe(true);
  });

  // Edge cases

  it('FAILS for Finnish generic "Määrä" alone (no product disambiguation)', () => {
    // Multilingual generic label coverage — Finnish "Määrä" = "Quantity".
    const document = setBodyFromFragment(`
      <label for="q1">Määrä</label>
      <input type="number" id="q1" name="quantity-1" value="1">
    `);
    expect(check(document.querySelector('#q1')!)).toBe(false);
  });

  it('FAILS when label is exactly 2 chars (below the 3-char minimum heuristic)', () => {
    // Below the minimum-length threshold even if not in the generic-token blocklist.
    const document = setBodyFromFragment(
      `<input type="number" name="qty" aria-label="XS" value="1">`,
    );
    expect(check(document.querySelector('input')!)).toBe(false);
  });

  // Boundary and locale variants

  it('FAILS Norwegian generic "Antall" (Norwegian for quantity)', () => {
    const document = setBodyFromFragment(`
      <label for="q1">Antall</label>
      <input type="number" id="q1" name="antall-1" value="1">
    `);
    expect(check(document.querySelector('#q1')!)).toBe(false);
  });

  it('PASSES Swedish product-specific aria-label with åäö', () => {
    const document = setBodyFromFragment(
      `<input type="number" name="qty" aria-label="Antal av Blå T-shirt storlek M" value="2">`,
    );
    expect(check(document.querySelector('input')!)).toBe(true);
  });

  it('PASSES Finnish product-specific aria-label', () => {
    const document = setBodyFromFragment(
      `<input type="number" name="qty" aria-label="Määrä: Sininen T-paita" value="1">`,
    );
    expect(check(document.querySelector('input')!)).toBe(true);
  });

  it('FAILS bare aria-label "Quantity" (no disambiguation)', () => {
    const document = setBodyFromFragment(
      `<input type="number" name="quantity" aria-label="Quantity" value="1">`,
    );
    expect(check(document.querySelector('input')!)).toBe(false);
  });

  it('SKIPS quantity-named input that is type=search (not numeric quantity)', () => {
    const document = setBodyFromFragment(`<input type="search" name="qty-search">`);
    expect(check(document.querySelector('input')!)).toBe(true);
  });

  it('PASSES Cyrillic product-specific aria-label', () => {
    const document = setBodyFromFragment(
      `<input type="number" name="qty" aria-label="Количество: Синяя футболка XL" value="1">`,
    );
    expect(check(document.querySelector('input')!)).toBe(true);
  });

  it('PASSES with aria-labelledby pointing to deeply nested product heading', () => {
    const document = setBodyFromFragment(`
      <div><div><div><div><div><div><div><div><div><div>
        <h4 id="prod-X">Red Backpack</h4>
      </div></div></div></div></div></div></div></div></div></div>
      <input type="number" name="qty-X" aria-labelledby="prod-X" value="1">
    `);
    expect(check(document.querySelector('input')!)).toBe(true);
  });
});
