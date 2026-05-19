// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { describe, it, expect, beforeEach } from 'vitest';

import { setBodyFromFragment, resetBody } from '../../test-utils.js';

import { check } from './currency-format-readable.js';

describe('banking/currency-format-readable — check', () => {
  beforeEach(() => resetBody());

  it('FAILS for plain text currency on banking element', () => {
    const doc = setBodyFromFragment(`<span class="balance">1 234,56 kr</span>`);
    expect(check(doc.querySelector('.balance')!)).toBe(false);
  });

  it('PASSES with <data value> wrapper', () => {
    const doc = setBodyFromFragment(
      `<span class="balance"><data value="1234.56">1 234,56 kr</data></span>`,
    );
    expect(check(doc.querySelector('.balance')!)).toBe(true);
  });

  it('PASSES with aria-label', () => {
    const doc = setBodyFromFragment(
      `<span class="amount" aria-label="1234 kronor 56 öre">1 234,56 kr</span>`,
    );
    expect(check(doc.querySelector('.amount')!)).toBe(true);
  });

  it('PASSES with <output>', () => {
    const doc = setBodyFromFragment(`<output class="balance">1 234,56 kr</output>`);
    expect(check(doc.querySelector('.balance')!)).toBe(true);
  });

  it('SKIPS non-currency elements', () => {
    const doc = setBodyFromFragment(`<span class="hero">Welcome</span>`);
    expect(check(doc.querySelector('.hero')!)).toBe(true);
  });

  // Edge cases — Phase 1C revision

  it('PASSES when descendant <data value> wraps amount (not direct child)', () => {
    // Rule accepts descendant <data> via querySelector — wrapping element passes.
    const doc = setBodyFromFragment(
      `<div class="balance"><strong><data value="999.00">999 kr</data></strong></div>`,
    );
    expect(check(doc.querySelector('.balance')!)).toBe(true);
  });

  it('SKIPS currency-class element that contains no digits', () => {
    // looksLikeCurrencyDisplay requires at least one digit in textContent.
    const doc = setBodyFromFragment(`<span class="balance">Pending…</span>`);
    expect(check(doc.querySelector('.balance')!)).toBe(true);
  });

  // Boundary / locale variants — Wave 2 expansion (LAGRANGE)

  it('PASSES Euro amount with aria-label', () => {
    const doc = setBodyFromFragment(
      `<span class="amount" aria-label="999 euros 50 cents">€ 999,50</span>`,
    );
    expect(check(doc.querySelector('.amount')!)).toBe(true);
  });

  it('PASSES USD amount with <output>', () => {
    const doc = setBodyFromFragment(`<output class="price">$1,234.56</output>`);
    expect(check(doc.querySelector('.price')!)).toBe(true);
  });

  it('FAILS Norwegian NOK plain text', () => {
    const doc = setBodyFromFragment(`<span class="balance">1 234,56 NOK</span>`);
    expect(check(doc.querySelector('.balance')!)).toBe(false);
  });

  it('FAILS Danish DKK plain text', () => {
    const doc = setBodyFromFragment(`<span class="saldo">1 234,56 DKK</span>`);
    expect(check(doc.querySelector('.saldo')!)).toBe(false);
  });

  it('FAILS Finnish kruunua plain text', () => {
    const doc = setBodyFromFragment(`<span class="amount">1 234,56 kruunua</span>`);
    expect(check(doc.querySelector('.amount')!)).toBe(false);
  });

  it('SKIPS GBP pound (£) without banking class', () => {
    const doc = setBodyFromFragment(`<span class="hero">£999.99</span>`);
    expect(check(doc.querySelector('.hero')!)).toBe(true);
  });

  it('PASSES Swedish "belopp" class with <data value>', () => {
    const doc = setBodyFromFragment(
      `<span class="belopp"><data value="100.00">100 kr</data></span>`,
    );
    expect(check(doc.querySelector('.belopp')!)).toBe(true);
  });

  it('PASSES "summa" class with aria-label', () => {
    const doc = setBodyFromFragment(
      `<span class="summa" aria-label="500 kronor totalt">500 kr</span>`,
    );
    expect(check(doc.querySelector('.summa')!)).toBe(true);
  });

  it('PASSES with id="balance" instead of class', () => {
    // looksLikeCurrencyDisplay checks both class AND id attrs.
    const doc = setBodyFromFragment(
      `<output id="balance">1 234,56 kr</output>`,
    );
    expect(check(doc.querySelector('#balance')!)).toBe(true);
  });

  it('PASSES with data-role="amount"', () => {
    // looksLikeCurrencyDisplay also checks data-role.
    const doc = setBodyFromFragment(
      `<output data-role="amount">1 234,56 kr</output>`,
    );
    expect(check(doc.querySelector('[data-role]')!)).toBe(true);
  });

  it('PASSES deeply nested <data value> wrapper (10+ levels)', () => {
    const doc = setBodyFromFragment(
      `<div class="balance"><div><div><div><div><div><div><div><div><div><div><data value="42.00">42 kr</data></div></div></div></div></div></div></div></div></div></div></div>`,
    );
    expect(check(doc.querySelector('.balance')!)).toBe(true);
  });
});
