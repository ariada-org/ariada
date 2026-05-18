// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { describe, it, expect, beforeEach } from 'vitest';

import { setBodyFromFragment, resetBody } from '../../test-utils.js';

import { check } from './checkout-form-label-association.js';

describe('checkout/form-label-association — check', () => {
  beforeEach(() => resetBody());

  it('FAILS when checkout input has only placeholder', () => {
    const doc = setBodyFromFragment(`
      <form class="checkout-form">
        <input type="email" placeholder="Email">
      </form>
    `);
    expect(check(doc.querySelector('input')!)).toBe(false);
  });

  it('PASSES with <label for=id>', () => {
    const doc = setBodyFromFragment(`
      <form class="checkout-form">
        <label for="email">Email address</label>
        <input type="email" id="email">
      </form>
    `);
    expect(check(doc.querySelector('input')!)).toBe(true);
  });

  it('PASSES with wrapping <label>', () => {
    const doc = setBodyFromFragment(`
      <form id="checkout-form">
        <label>Email <input type="email"></label>
      </form>
    `);
    expect(check(doc.querySelector('input')!)).toBe(true);
  });

  it('PASSES with aria-label', () => {
    const doc = setBodyFromFragment(`
      <form class="payment-form">
        <input type="email" aria-label="Email">
      </form>
    `);
    expect(check(doc.querySelector('input')!)).toBe(true);
  });

  it('PASSES with aria-labelledby', () => {
    const doc = setBodyFromFragment(`
      <form class="checkout">
        <span id="lbl">Email</span>
        <input type="email" aria-labelledby="lbl">
      </form>
    `);
    expect(check(doc.querySelector('input')!)).toBe(true);
  });

  it('SKIPS inputs outside checkout context', () => {
    const doc = setBodyFromFragment(`
      <form class="search">
        <input type="text" placeholder="Search">
      </form>
    `);
    expect(check(doc.querySelector('input')!)).toBe(true);
  });

  it('SKIPS submit / hidden inputs', () => {
    const doc = setBodyFromFragment(`
      <form class="checkout-form">
        <input type="hidden" name="csrf">
      </form>
    `);
    expect(check(doc.querySelector('input')!)).toBe(true);
  });

  // Edge cases — Phase 1C revision

  it('FAILS when aria-labelledby points to non-existent id', () => {
    // Broken aria-labelledby reference — must not be treated as a passing label.
    const doc = setBodyFromFragment(`
      <form class="checkout-form">
        <input type="email" aria-labelledby="missing-id">
      </form>
    `);
    expect(check(doc.querySelector('input')!)).toBe(false);
  });

  it('PASSES with title attribute as last-resort programmatic label', () => {
    // title is accepted by hasProgrammaticLabel as a fallback.
    const doc = setBodyFromFragment(`
      <form class="checkout-form">
        <input type="email" title="Email">
      </form>
    `);
    expect(check(doc.querySelector('input')!)).toBe(true);
  });

  // Boundary / locale variants — Wave 2 expansion (LAGRANGE)

  it('FAILS <select> in checkout with no label', () => {
    const doc = setBodyFromFragment(`
      <form class="checkout-form">
        <select name="country"><option>SE</option></select>
      </form>
    `);
    expect(check(doc.querySelector('select')!)).toBe(false);
  });

  it('PASSES <textarea> in checkout with aria-label', () => {
    const doc = setBodyFromFragment(`
      <form class="checkout">
        <textarea aria-label="Order notes"></textarea>
      </form>
    `);
    expect(check(doc.querySelector('textarea')!)).toBe(true);
  });

  it('SKIPS button-type input in checkout (not labelable interactive field)', () => {
    const doc = setBodyFromFragment(`
      <form class="checkout-form">
        <input type="button" value="Click">
      </form>
    `);
    expect(check(doc.querySelector('input')!)).toBe(true);
  });

  it('SKIPS reset-type input in checkout', () => {
    const doc = setBodyFromFragment(`
      <form class="checkout-form">
        <input type="reset" value="Reset">
      </form>
    `);
    expect(check(doc.querySelector('input')!)).toBe(true);
  });

  it('SKIPS image-type input in checkout', () => {
    const doc = setBodyFromFragment(`
      <form class="checkout-form">
        <input type="image" src="submit.png" alt="Submit">
      </form>
    `);
    expect(check(doc.querySelector('input')!)).toBe(true);
  });

  it('FAILS with empty aria-label (whitespace only)', () => {
    const doc = setBodyFromFragment(`
      <form class="checkout-form">
        <input type="email" aria-label="    ">
      </form>
    `);
    expect(check(doc.querySelector('input')!)).toBe(false);
  });

  it('FAILS with wrapping label that has no text content', () => {
    const doc = setBodyFromFragment(`
      <form class="checkout-form">
        <label><input type="email"></label>
      </form>
    `);
    expect(check(doc.querySelector('input')!)).toBe(false);
  });

  it('PASSES with aria-labelledby pointing to multiple IDs (concatenated)', () => {
    const doc = setBodyFromFragment(`
      <form class="checkout-form">
        <span id="prefix">Customer</span>
        <span id="suffix">Email</span>
        <input type="email" aria-labelledby="prefix suffix">
      </form>
    `);
    expect(check(doc.querySelector('input')!)).toBe(true);
  });

  it('PASSES with Swedish Unicode label content (åäö)', () => {
    const doc = setBodyFromFragment(`
      <form class="checkout-form">
        <label for="addr">Gatuadress (örnsköldsvik)</label>
        <input type="text" id="addr">
      </form>
    `);
    expect(check(doc.querySelector('input')!)).toBe(true);
  });

  it('FAILS deeply nested checkout input (10+ levels) with no label', () => {
    const doc = setBodyFromFragment(`
      <form class="checkout-form">
        <div><div><div><div><div><div><div><div><div><div>
          <input type="text" name="addr">
        </div></div></div></div></div></div></div></div></div></div>
      </form>
    `);
    expect(check(doc.querySelector('input')!)).toBe(false);
  });

  it('PASSES special-character id with CSS-escape (label[for] selector safe)', () => {
    // Validates cssEscape helper for ids with special chars.
    const doc = setBodyFromFragment(`
      <form class="checkout-form">
        <label for="email.address">Email</label>
        <input type="email" id="email.address">
      </form>
    `);
    expect(check(doc.querySelector('input')!)).toBe(true);
  });
});
