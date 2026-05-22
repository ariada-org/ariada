// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { describe, it, expect, beforeEach } from 'vitest';

import { setBodyFromFragment, resetBody } from '../../test-utils.js';

import { check } from './autocomplete-personal-data.js';

describe('checkout/autocomplete-personal-data — check', () => {
  beforeEach(() => resetBody());

  it('FAILS when email field has no autocomplete', () => {
    const document = setBodyFromFragment(`<input type="email" name="email" id="e">`);
    expect(check(document.querySelector('#e')!)).toBe(false);
  });

  it('PASSES when email field has autocomplete="email"', () => {
    const document = setBodyFromFragment(`<input type="email" name="email" id="e" autocomplete="email">`);
    expect(check(document.querySelector('#e')!)).toBe(true);
  });

  it('FAILS when autocomplete="off" on personal data', () => {
    const document = setBodyFromFragment(`<input type="tel" name="phone" id="p" autocomplete="off">`);
    expect(check(document.querySelector('#p')!)).toBe(false);
  });

  it('PASSES on Swedish field name "förnamn" with autocomplete="given-name"', () => {
    const document = setBodyFromFragment(
      `<input type="text" name="förnamn" id="f" autocomplete="given-name">`,
    );
    expect(check(document.querySelector('#f')!)).toBe(true);
  });

  it('FAILS on Finnish field name "puhelin" without autocomplete', () => {
    const document = setBodyFromFragment(`<input type="tel" name="puhelin" id="p">`);
    expect(check(document.querySelector('#p')!)).toBe(false);
  });

  it('SKIPS non-personal-data fields (e.g. coupon code)', () => {
    const document = setBodyFromFragment(`<input type="text" name="coupon" id="c">`);
    expect(check(document.querySelector('#c')!)).toBe(true);
  });

  it('SKIPS hidden/submit inputs', () => {
    const document = setBodyFromFragment(`<input type="hidden" name="email">`);
    expect(check(document.querySelector('input')!)).toBe(true);
  });

  // Edge cases

  it('FAILS when autocomplete="none" on personal data (alias of off)', () => {
    // autocomplete="none" disables the feature just like "off".
    const document = setBodyFromFragment(
      `<input type="email" name="email" id="e" autocomplete="none">`,
    );
    expect(check(document.querySelector('#e')!)).toBe(false);
  });

  it('PASSES on <textarea name="address"> with autocomplete="street-address"', () => {
    // Rule applies to <textarea> (multi-line address), not just <input>.
    const document = setBodyFromFragment(
      `<textarea name="address" id="a" autocomplete="street-address"></textarea>`,
    );
    expect(check(document.querySelector('#a')!)).toBe(true);
  });

  // Boundary and locale variants

  it('FAILS Norwegian "fornavn" without autocomplete', () => {
    const document = setBodyFromFragment(`<input type="text" name="fornavn" id="f">`);
    expect(check(document.querySelector('#f')!)).toBe(false);
  });

  it('PASSES Norwegian "etternavn" with autocomplete="family-name"', () => {
    const document = setBodyFromFragment(
      `<input type="text" name="etternavn" id="f" autocomplete="family-name">`,
    );
    expect(check(document.querySelector('#f')!)).toBe(true);
  });

  it('FAILS Finnish "etunimi" without autocomplete', () => {
    const document = setBodyFromFragment(`<input type="text" name="etunimi" id="e">`);
    expect(check(document.querySelector('#e')!)).toBe(false);
  });

  it('FAILS Finnish "sukunimi" without autocomplete', () => {
    const document = setBodyFromFragment(`<input type="text" name="sukunimi" id="s">`);
    expect(check(document.querySelector('#s')!)).toBe(false);
  });

  it('FAILS Danish "adresse" without autocomplete', () => {
    const document = setBodyFromFragment(`<input type="text" name="adresse" id="a">`);
    expect(check(document.querySelector('#a')!)).toBe(false);
  });

  it('FAILS Swedish "postnummer" without autocomplete', () => {
    const document = setBodyFromFragment(`<input type="text" name="postnummer" id="p">`);
    expect(check(document.querySelector('#p')!)).toBe(false);
  });

  it('FAILS Finnish "postinumero" without autocomplete', () => {
    const document = setBodyFromFragment(`<input type="text" name="postinumero" id="p">`);
    expect(check(document.querySelector('#p')!)).toBe(false);
  });

  it('FAILS Finnish "kaupunki" (city) without autocomplete', () => {
    const document = setBodyFromFragment(`<input type="text" name="kaupunki" id="k">`);
    expect(check(document.querySelector('#k')!)).toBe(false);
  });

  it('SKIPS checkbox personal-data field (excluded type)', () => {
    const document = setBodyFromFragment(
      `<input type="checkbox" name="email-opt-in" id="e">`,
    );
    expect(check(document.querySelector('#e')!)).toBe(true);
  });

  it('SKIPS file-type address-named input', () => {
    const document = setBodyFromFragment(
      `<input type="file" name="address-proof" id="a">`,
    );
    expect(check(document.querySelector('#a')!)).toBe(true);
  });

  it('PASSES with uppercase AUTOCOMPLETE="EMAIL" (case-insensitive normalized)', () => {
    const document = setBodyFromFragment(
      `<input type="email" name="email" id="e" AUTOCOMPLETE="EMAIL">`,
    );
    expect(check(document.querySelector('#e')!)).toBe(true);
  });

  it('FAILS with autocomplete=" " (whitespace only — empty after trim)', () => {
    const document = setBodyFromFragment(
      `<input type="email" name="email" id="e" autocomplete="   ">`,
    );
    expect(check(document.querySelector('#e')!)).toBe(false);
  });

  it('PASSES Cyrillic aria-label with English "email" word + autocomplete', () => {
    const document = setBodyFromFragment(
      `<input type="text" id="e" aria-label="Введите email адрес" autocomplete="email">`,
    );
    expect(check(document.querySelector('#e')!)).toBe(true);
  });
});
