// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { describe, it, expect, beforeEach } from 'vitest';

import { setBodyFromFragment, resetBody } from '../../test-utils.js';

import { check } from './cart-update-live-region.js';

describe('checkout/cart-update-live-region — check', () => {
  beforeEach(() => resetBody());

  it('FAILS when cart region has no live-region attribute', () => {
    const doc = setBodyFromFragment(`<div id="cart-summary"><span>Items: 3</span></div>`);
    expect(check(doc.querySelector('#cart-summary')!)).toBe(false);
  });

  it('PASSES when cart region has aria-live=polite', () => {
    const doc = setBodyFromFragment(
      `<div id="cart-summary" aria-live="polite"><span>Items: 3</span></div>`,
    );
    expect(check(doc.querySelector('#cart-summary')!)).toBe(true);
  });

  it('PASSES when cart region has role=status', () => {
    const doc = setBodyFromFragment(`<div class="cart" role="status">Items: 3</div>`);
    expect(check(doc.querySelector('.cart')!)).toBe(true);
  });

  it('PASSES when cart region has role=alert', () => {
    const doc = setBodyFromFragment(`<div data-role="basket" role="alert">Items: 3</div>`);
    expect(check(doc.querySelector('[data-role="basket"]')!)).toBe(true);
  });

  it('PASSES when ancestor has aria-live=polite', () => {
    const doc = setBodyFromFragment(
      `<section aria-live="polite"><div class="cart-summary">3 items</div></section>`,
    );
    expect(check(doc.querySelector('.cart-summary')!)).toBe(true);
  });

  it('SKIPS non-cart elements', () => {
    const doc = setBodyFromFragment(`<div id="hero">Welcome</div>`);
    expect(check(doc.querySelector('#hero')!)).toBe(true);
  });

  // Edge cases — Phase 1C revision

  it('PASSES when cart region uses role="log" (less common but valid live region)', () => {
    const doc = setBodyFromFragment(`<div id="cart-summary" role="log">3 items</div>`);
    expect(check(doc.querySelector('#cart-summary')!)).toBe(true);
  });

  it('FAILS when cart region only has aria-live="off" (explicitly muted)', () => {
    // aria-live="off" is not a passing value — only "polite" / "assertive" satisfy.
    const doc = setBodyFromFragment(
      `<div id="cart-summary" aria-live="off">3 items</div>`,
    );
    expect(check(doc.querySelector('#cart-summary')!)).toBe(false);
  });

  // Boundary / locale variants — Wave 2 expansion (LAGRANGE)

  it('PASSES Swedish "varukorg" class with role=status', () => {
    const doc = setBodyFromFragment(`<div class="varukorg" role="status">3 varor</div>`);
    expect(check(doc.querySelector('.varukorg')!)).toBe(true);
  });

  it('PASSES Finnish "ostoskori" id with aria-live', () => {
    const doc = setBodyFromFragment(`<div id="ostoskori" aria-live="polite">3 tuotetta</div>`);
    expect(check(doc.querySelector('#ostoskori')!)).toBe(true);
  });

  it('PASSES aria-live="assertive" on cart region', () => {
    const doc = setBodyFromFragment(`<div id="cart" aria-live="assertive">3 items</div>`);
    expect(check(doc.querySelector('#cart')!)).toBe(true);
  });

  it('FAILS cart region with aria-live="" empty string', () => {
    const doc = setBodyFromFragment(`<div id="cart-summary" aria-live="">3 items</div>`);
    expect(check(doc.querySelector('#cart-summary')!)).toBe(false);
  });

  it('PASSES deeply nested cart with grandparent live region (10+ levels)', () => {
    const doc = setBodyFromFragment(
      `<section aria-live="polite"><div><div><div><div><div><div><div><div><div><div class="cart-summary">3</div></div></div></div></div></div></div></div></div></section>`,
    );
    expect(check(doc.querySelector('.cart-summary')!)).toBe(true);
  });

  it('PASSES empty cart region with role=status (zero items still announced)', () => {
    const doc = setBodyFromFragment(`<div id="cart-summary" role="status"></div>`);
    expect(check(doc.querySelector('#cart-summary')!)).toBe(true);
  });

  it('SKIPS hero element with no cart-pattern class', () => {
    const doc = setBodyFromFragment(`<div class="promo-banner">Save 20%</div>`);
    expect(check(doc.querySelector('.promo-banner')!)).toBe(true);
  });

  it('PASSES with Cyrillic cart label and live region', () => {
    const doc = setBodyFromFragment(
      `<div id="cart-summary" aria-live="polite">Корзина: 3 товара 🛒</div>`,
    );
    expect(check(doc.querySelector('#cart-summary')!)).toBe(true);
  });
});
