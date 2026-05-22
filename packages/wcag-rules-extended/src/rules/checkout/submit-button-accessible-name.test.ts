// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { describe, it, expect, beforeEach } from 'vitest';

import { setBodyFromFragment, resetBody } from '../../test-utils.js';

import { check } from './submit-button-accessible-name.js';

describe('checkout/submit-button-accessible-name — check', () => {
  beforeEach(() => resetBody());

  it('FAILS when submit text is generic "Submit"', () => {
    const document = setBodyFromFragment(`
      <form id="checkout-form">
        <button type="submit">Submit</button>
      </form>
    `);
    expect(check(document.querySelector('button')!)).toBe(false);
  });

  it('FAILS when submit text is empty', () => {
    const document = setBodyFromFragment(`
      <form class="checkout">
        <button type="submit"></button>
      </form>
    `);
    expect(check(document.querySelector('button')!)).toBe(false);
  });

  it('PASSES when submit text is action-specific', () => {
    const document = setBodyFromFragment(`
      <form id="checkout-form">
        <button type="submit">Place order</button>
      </form>
    `);
    expect(check(document.querySelector('button')!)).toBe(true);
  });

  it('PASSES when submit text includes amount', () => {
    const document = setBodyFromFragment(`
      <form id="checkout-form">
        <button type="submit">Pay 199 SEK</button>
      </form>
    `);
    expect(check(document.querySelector('button')!)).toBe(true);
  });

  it('FAILS on Swedish generic "Skicka"', () => {
    const document = setBodyFromFragment(`
      <form class="checkout">
        <button type="submit">Skicka</button>
      </form>
    `);
    expect(check(document.querySelector('button')!)).toBe(false);
  });

  it('SKIPS submit buttons outside checkout context', () => {
    const document = setBodyFromFragment(`
      <form class="search">
        <button type="submit">Submit</button>
      </form>
    `);
    expect(check(document.querySelector('button')!)).toBe(true);
  });

  it('PASSES <input type=submit> with action value', () => {
    const document = setBodyFromFragment(`
      <form class="checkout-form">
        <input type="submit" value="Complete purchase">
      </form>
    `);
    expect(check(document.querySelector('input')!)).toBe(true);
  });

  // Edge cases

  it('PASSES button with aria-label overriding generic visible text', () => {
    // aria-label takes precedence over visible text per getAccessibleNameLite order.
    const document = setBodyFromFragment(`
      <form class="checkout-form">
        <button type="submit" aria-label="Pay 299 EUR for order">Submit</button>
      </form>
    `);
    expect(check(document.querySelector('button')!)).toBe(true);
  });

  it('FAILS on Finnish generic "Lähetä" inside checkout context', () => {
    // VAGUE_LABELS includes Finnish "lähetä" = "send".
    const document = setBodyFromFragment(`
      <form class="checkout-form">
        <button type="submit">Lähetä</button>
      </form>
    `);
    expect(check(document.querySelector('button')!)).toBe(false);
  });

  // Boundary and locale variants

  it('FAILS Norwegian generic "Sende"', () => {
    const document = setBodyFromFragment(`
      <form class="checkout">
        <button type="submit">Sende</button>
      </form>
    `);
    expect(check(document.querySelector('button')!)).toBe(false);
  });

  it('FAILS Norwegian generic "Fortsett"', () => {
    const document = setBodyFromFragment(`
      <form class="checkout">
        <button type="submit">Fortsett</button>
      </form>
    `);
    expect(check(document.querySelector('button')!)).toBe(false);
  });

  it('FAILS Finnish generic "Jatka"', () => {
    const document = setBodyFromFragment(`
      <form class="checkout">
        <button type="submit">Jatka</button>
      </form>
    `);
    expect(check(document.querySelector('button')!)).toBe(false);
  });

  it('FAILS Swedish generic "Fortsätt"', () => {
    const document = setBodyFromFragment(`
      <form class="checkout">
        <button type="submit">Fortsätt</button>
      </form>
    `);
    expect(check(document.querySelector('button')!)).toBe(false);
  });

  it('PASSES button[type=submit] not in form but inside [id*=checkout]', () => {
    // The "checkout" matcher selects multiple patterns, including id wrapper + nested form.
    const document = setBodyFromFragment(`
      <section id="checkout-page">
        <form>
          <button type="submit">Place order</button>
        </form>
      </section>
    `);
    expect(check(document.querySelector('button')!)).toBe(true);
  });

  it('PASSES button with no explicit type (defaults to submit per HTML)', () => {
    // The matcher treats <button> with no type as submit.
    const document = setBodyFromFragment(`
      <form class="checkout">
        <button>Place order now</button>
      </form>
    `);
    expect(check(document.querySelector('button')!)).toBe(true);
  });

  it('SKIPS button[type=button] inside checkout (not a submit)', () => {
    const document = setBodyFromFragment(`
      <form class="checkout">
        <button type="button">Submit</button>
      </form>
    `);
    expect(check(document.querySelector('button')!)).toBe(true);
  });

  it('FAILS button with leading/trailing whitespace around generic text', () => {
    // Trim then lowercase before VAGUE_LABELS check.
    const document = setBodyFromFragment(`
      <form class="checkout">
        <button type="submit">   Submit   </button>
      </form>
    `);
    expect(check(document.querySelector('button')!)).toBe(false);
  });

  it('PASSES button with Cyrillic action-specific text', () => {
    const document = setBodyFromFragment(`
      <form class="checkout">
        <button type="submit">Оплатить 999 рублей</button>
      </form>
    `);
    expect(check(document.querySelector('button')!)).toBe(true);
  });

  it('FAILS form[class*=payment] context with generic "Submit"', () => {
    const document = setBodyFromFragment(`
      <form class="payment-form">
        <button type="submit">Submit</button>
      </form>
    `);
    expect(check(document.querySelector('button')!)).toBe(false);
  });

  it('PASSES button deeply nested (10+ levels) inside checkout form', () => {
    const document = setBodyFromFragment(`
      <form class="checkout">
        <div><div><div><div><div><div><div><div><div><div>
          <button type="submit">Place order</button>
        </div></div></div></div></div></div></div></div></div></div>
      </form>
    `);
    expect(check(document.querySelector('button')!)).toBe(true);
  });
});
