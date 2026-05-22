// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
/**
 * Tests for ariada/checkout/payment-fieldset-grouping rule.
 *
 * Rule subject: WCAG 1.3.1 Info and Relationships, WCAG 4.1.2 Name Role Value.
 * Payment method radio inputs MUST be grouped into a programmatic group
 * (either `<fieldset>` + `<legend>`, or ARIA `role="radiogroup"` + accessible name).
 *
 * @see https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html
 * @see https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html
 */

import { describe, it, expect, beforeEach } from 'vitest';

import { setBodyFromFragment, resetBody } from '../../test-utils.js';

import { check } from './payment-fieldset-grouping.js';

describe('checkout/payment-fieldset-grouping — check', () => {
  beforeEach(() => resetBody());

  it('FAILS when payment radio inputs are not grouped (no fieldset, no radiogroup)', () => {
    const document = setBodyFromFragment(`
      <form>
        <h2>Payment method</h2>
        <input type="radio" name="payment" value="card" id="p-card">
        <label for="p-card">Credit card</label>
        <input type="radio" name="payment" value="paypal" id="p-paypal">
        <label for="p-paypal">PayPal</label>
      </form>
    `);
    const firstRadio = document.querySelector('input[name="payment"]')!;
    expect(check(firstRadio)).toBe(false);
  });

  it('PASSES when radio inputs are wrapped in <fieldset> with <legend>', () => {
    const document = setBodyFromFragment(`
      <form>
        <fieldset>
          <legend>Choose payment method</legend>
          <input type="radio" name="payment" value="card" id="p-card">
          <label for="p-card">Credit card</label>
          <input type="radio" name="payment" value="paypal" id="p-paypal">
          <label for="p-paypal">PayPal</label>
        </fieldset>
      </form>
    `);
    const firstRadio = document.querySelector('input[name="payment"]')!;
    expect(check(firstRadio)).toBe(true);
  });

  it('PASSES when radio inputs are inside ARIA radiogroup with aria-labelledby', () => {
    const document = setBodyFromFragment(`
      <form>
        <h3 id="pay-heading">Payment method</h3>
        <div role="radiogroup" aria-labelledby="pay-heading">
          <input type="radio" name="payment" value="card" id="p-card">
          <label for="p-card">Credit card</label>
          <input type="radio" name="payment" value="paypal" id="p-paypal">
          <label for="p-paypal">PayPal</label>
        </div>
      </form>
    `);
    const firstRadio = document.querySelector('input[name="payment"]')!;
    expect(check(firstRadio)).toBe(true);
  });

  it('PASSES when radio inputs are inside ARIA radiogroup with aria-label', () => {
    const document = setBodyFromFragment(`
      <form>
        <div role="radiogroup" aria-label="Select payment method">
          <input type="radio" name="payment" value="card">
          <input type="radio" name="payment" value="paypal">
        </div>
      </form>
    `);
    const firstRadio = document.querySelector('input[name="payment"]')!;
    expect(check(firstRadio)).toBe(true);
  });

  it('FAILS when fieldset is missing <legend>', () => {
    const document = setBodyFromFragment(`
      <form>
        <fieldset>
          <input type="radio" name="payment" value="card">
          <input type="radio" name="payment" value="paypal">
        </fieldset>
      </form>
    `);
    const firstRadio = document.querySelector('input[name="payment"]')!;
    expect(check(firstRadio)).toBe(false);
  });

  it('FAILS when ARIA radiogroup has no accessible name', () => {
    const document = setBodyFromFragment(`
      <form>
        <div role="radiogroup">
          <input type="radio" name="payment" value="card">
          <input type="radio" name="payment" value="paypal">
        </div>
      </form>
    `);
    const firstRadio = document.querySelector('input[name="payment"]')!;
    expect(check(firstRadio)).toBe(false);
  });

  it('SKIPS (returns true) when there is only ONE radio of this name (not a group)', () => {
    const document = setBodyFromFragment(`
      <form>
        <input type="radio" name="single-option" value="only">
      </form>
    `);
    const radio = document.querySelector('input[name="single-option"]')!;
    // Rule only applies to groups of 2+ radios with same name.
    // Single radio is a semantic error of its own kind, handled elsewhere.
    expect(check(radio)).toBe(true);
  });

  // Edge cases

  it('FAILS when fieldset has <legend> but legend is whitespace-only', () => {
    // Legend exists but its text content is empty — screen readers get no group name.
    const document = setBodyFromFragment(`
      <form>
        <fieldset>
          <legend>   </legend>
          <input type="radio" name="payment" value="card">
          <input type="radio" name="payment" value="paypal">
        </fieldset>
      </form>
    `);
    const firstRadio = document.querySelector('input[name="payment"]')!;
    expect(check(firstRadio)).toBe(false);
  });

  it('PASSES when radio name attribute uses an alternate token ("method")', () => {
    // Heuristic must match /pay|payment|tender|checkout|method/i — verify "method" variant.
    const document = setBodyFromFragment(`
      <form>
        <fieldset>
          <legend>Choose method</legend>
          <input type="radio" name="payment-method" value="a">
          <input type="radio" name="payment-method" value="b">
        </fieldset>
      </form>
    `);
    const firstRadio = document.querySelector('input[name="payment-method"]')!;
    expect(check(firstRadio)).toBe(true);
  });

  // Boundary and locale variants

  it('PASSES Swedish radiogroup labelled "Välj betalningsmetod"', () => {
    const document = setBodyFromFragment(`
      <form>
        <div role="radiogroup" aria-label="Välj betalningsmetod">
          <input type="radio" name="payment" value="card">
          <input type="radio" name="payment" value="swish">
        </div>
      </form>
    `);
    expect(check(document.querySelector('input[name="payment"]')!)).toBe(true);
  });

  it('PASSES Finnish radiogroup labelled "Valitse maksutapa"', () => {
    const document = setBodyFromFragment(`
      <form>
        <div role="radiogroup" aria-label="Valitse maksutapa">
          <input type="radio" name="payment" value="kortti">
          <input type="radio" name="payment" value="lasku">
        </div>
      </form>
    `);
    expect(check(document.querySelector('input[name="payment"]')!)).toBe(true);
  });

  it('FAILS three+ ungrouped payment radios (all evaluated)', () => {
    const document = setBodyFromFragment(`
      <form>
        <input type="radio" name="payment" value="a">
        <input type="radio" name="payment" value="b">
        <input type="radio" name="payment" value="c">
      </form>
    `);
    const radios = Array.from(document.querySelectorAll('input[name="payment"]'));
    expect(radios.length).toBe(3);
    for (const r of radios) {
      expect(check(r)).toBe(false);
    }
  });

  it('PASSES with aria-labelledby pointing to deeply nested heading', () => {
    const document = setBodyFromFragment(`
      <form>
        <div><div><div><div><div><div><div><div><div>
          <h3 id="pay-h">Payment</h3>
        </div></div></div></div></div></div></div></div></div>
        <div role="radiogroup" aria-labelledby="pay-h">
          <input type="radio" name="payment" value="card">
          <input type="radio" name="payment" value="paypal">
        </div>
      </form>
    `);
    expect(check(document.querySelector('input[name="payment"]')!)).toBe(true);
  });

  it('SKIPS non-payment radio group (name="theme")', () => {
    const document = setBodyFromFragment(`
      <form>
        <input type="radio" name="theme" value="dark">
        <input type="radio" name="theme" value="light">
      </form>
    `);
    expect(check(document.querySelector('input[name="theme"]')!)).toBe(true);
  });

  it('FAILS payment radios when fieldset legend has only whitespace+newlines', () => {
    const document = setBodyFromFragment(`
      <form>
        <fieldset>
          <legend>

          </legend>
          <input type="radio" name="payment" value="a">
          <input type="radio" name="payment" value="b">
        </fieldset>
      </form>
    `);
    expect(check(document.querySelector('input[name="payment"]')!)).toBe(false);
  });

  it('FAILS radiogroup with aria-labelledby pointing to empty span', () => {
    const document = setBodyFromFragment(`
      <form>
        <span id="empty-h"></span>
        <div role="radiogroup" aria-labelledby="empty-h">
          <input type="radio" name="payment" value="a">
          <input type="radio" name="payment" value="b">
        </div>
      </form>
    `);
    expect(check(document.querySelector('input[name="payment"]')!)).toBe(false);
  });

  it('PASSES with Cyrillic radiogroup aria-label', () => {
    const document = setBodyFromFragment(`
      <form>
        <div role="radiogroup" aria-label="Выберите способ оплаты">
          <input type="radio" name="payment" value="card">
          <input type="radio" name="payment" value="cash">
        </div>
      </form>
    `);
    expect(check(document.querySelector('input[name="payment"]')!)).toBe(true);
  });
});
