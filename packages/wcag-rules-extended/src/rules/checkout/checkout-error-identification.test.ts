// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { describe, it, expect, beforeEach } from 'vitest';

import { setBodyFromFragment, resetBody } from '../../test-utils.js';

import { check } from './checkout-error-identification.js';

describe('checkout/error-identification — check', () => {
  beforeEach(() => resetBody());

  it('FAILS when error has no live-region and no field reference', () => {
    const doc = setBodyFromFragment(`
      <form>
        <input id="email" type="email">
        <div class="form-error" id="email-err">Invalid email address</div>
      </form>
    `);
    expect(check(doc.querySelector('.form-error')!)).toBe(false);
  });

  it('PASSES when error has role=alert', () => {
    const doc = setBodyFromFragment(`
      <div class="error-message" role="alert">Invalid email</div>
    `);
    // role=alert means looksLikeErrorMessage returns false (skip rule), check returns true
    expect(check(doc.querySelector('.error-message')!)).toBe(true);
  });

  it('PASSES when error has aria-live=assertive', () => {
    const doc = setBodyFromFragment(
      `<div class="checkout-error" aria-live="assertive">Card declined</div>`,
    );
    expect(check(doc.querySelector('.checkout-error')!)).toBe(true);
  });

  it('PASSES when input references error via aria-errormessage', () => {
    const doc = setBodyFromFragment(`
      <form>
        <input id="email" aria-errormessage="email-err" aria-invalid="true">
        <div class="form-error" id="email-err">Invalid email address</div>
      </form>
    `);
    expect(check(doc.querySelector('.form-error')!)).toBe(true);
  });

  it('PASSES when input references error via aria-describedby', () => {
    const doc = setBodyFromFragment(`
      <form>
        <input id="email" aria-describedby="email-err">
        <div class="form-error" id="email-err">Invalid email</div>
      </form>
    `);
    expect(check(doc.querySelector('.form-error')!)).toBe(true);
  });

  it('SKIPS empty error containers (not currently in error state)', () => {
    const doc = setBodyFromFragment(`<div class="error" id="err"></div>`);
    expect(check(doc.querySelector('.error')!)).toBe(true);
  });

  it('SKIPS non-error elements', () => {
    const doc = setBodyFromFragment(`<div class="info">Hi</div>`);
    expect(check(doc.querySelector('.info')!)).toBe(true);
  });

  // Edge cases — Phase 1C revision

  it('SKIPS error containers with whitespace-only text (not currently in error state)', () => {
    const doc = setBodyFromFragment(`<div class="form-error" id="err">   \n\t  </div>`);
    expect(check(doc.querySelector('.form-error')!)).toBe(true);
  });

  it('PASSES on multilingual error class "fel-meddelande" with live region', () => {
    // Heuristic includes Nordic / European error tokens: fel|virhe|fout|erreur|fehler.
    const doc = setBodyFromFragment(
      `<div class="fel-meddelande" aria-live="polite">Felaktig e-postadress</div>`,
    );
    expect(check(doc.querySelector('.fel-meddelande')!)).toBe(true);
  });

  // Boundary / locale variants — Wave 2 expansion (LAGRANGE)

  it('PASSES Finnish "virhe-viesti" class with role=alert', () => {
    const doc = setBodyFromFragment(
      `<div class="virhe-viesti" role="alert">Virheellinen sähköposti</div>`,
    );
    expect(check(doc.querySelector('.virhe-viesti')!)).toBe(true);
  });

  it('PASSES German "fehler-meldung" class with aria-live', () => {
    const doc = setBodyFromFragment(
      `<div class="fehler-meldung" aria-live="assertive">Ungültige E-Mail</div>`,
    );
    expect(check(doc.querySelector('.fehler-meldung')!)).toBe(true);
  });

  it('FAILS when aria-errormessage points to non-existent ID', () => {
    const doc = setBodyFromFragment(`
      <form>
        <input id="email" aria-errormessage="ghost-id" aria-invalid="true">
        <div class="form-error" id="email-err">Invalid email</div>
      </form>
    `);
    expect(check(doc.querySelector('.form-error')!)).toBe(false);
  });

  it('PASSES when error has role=status with explicit text', () => {
    const doc = setBodyFromFragment(`<div class="form-error" role="status">Server error</div>`);
    expect(check(doc.querySelector('.form-error')!)).toBe(true);
  });

  it('FAILS when error has aria-live="off" (explicitly muted)', () => {
    const doc = setBodyFromFragment(
      `<div class="checkout-error" aria-live="off">Card declined</div>`,
    );
    expect(check(doc.querySelector('.checkout-error')!)).toBe(false);
  });

  it('PASSES deeply nested error referenced via aria-errormessage', () => {
    const doc = setBodyFromFragment(`
      <form>
        <input id="phone" aria-errormessage="err-phone" aria-invalid="true">
        <div><div><div><div><div><div><div><div><div>
          <div class="form-error" id="err-phone">Invalid phone</div>
        </div></div></div></div></div></div></div></div></div>
      </form>
    `);
    expect(check(doc.querySelector('.form-error')!)).toBe(true);
  });

  it('SKIPS empty error containers (whitespace text after trim)', () => {
    const doc = setBodyFromFragment(`<div class="form-error" id="err">  </div>`);
    expect(check(doc.querySelector('.form-error')!)).toBe(true);
  });

  it('PASSES error with Cyrillic text and aria-live', () => {
    const doc = setBodyFromFragment(
      `<div class="checkout-error" aria-live="polite">Неверная карта 💳</div>`,
    );
    expect(check(doc.querySelector('.checkout-error')!)).toBe(true);
  });
});
