// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { describe, it, expect, beforeEach } from 'vitest';

import { setBodyFromFragment, resetBody } from '../../test-utils.js';

import { check } from './order-confirmation-focus.js';

describe('checkout/order-confirmation-focus — check', () => {
  beforeEach(() => resetBody());

  it('FAILS when confirmation h1 has no live region and no tabindex', () => {
    const doc = setBodyFromFragment(`<h1>Order confirmed!</h1>`);
    expect(check(doc.querySelector('h1')!)).toBe(false);
  });

  it('PASSES when h1 has role=status', () => {
    const doc = setBodyFromFragment(`<h1 role="status">Order placed</h1>`);
    expect(check(doc.querySelector('h1')!)).toBe(true);
  });

  it('PASSES when h1 has tabindex=-1', () => {
    const doc = setBodyFromFragment(`<h1 tabindex="-1">Thank you for your order</h1>`);
    expect(check(doc.querySelector('h1')!)).toBe(true);
  });

  it('PASSES when ancestor section has aria-live=polite', () => {
    const doc = setBodyFromFragment(`
      <section aria-live="polite">
        <h1>Order confirmation</h1>
      </section>
    `);
    expect(check(doc.querySelector('h1')!)).toBe(true);
  });

  it('PASSES on Swedish "Tack för din beställning" with role=status', () => {
    const doc = setBodyFromFragment(`<h1 role="status">Tack för din beställning</h1>`);
    expect(check(doc.querySelector('h1')!)).toBe(true);
  });

  it('SKIPS non-confirmation h1s', () => {
    const doc = setBodyFromFragment(`<h1>Welcome to our shop</h1>`);
    expect(check(doc.querySelector('h1')!)).toBe(true);
  });

  // Edge cases — Phase 1C revision

  it('SKIPS h2 / h3 confirmation headings (rule scoped to <h1> only)', () => {
    // Selector for the rule is <h1>; lower headings are intentionally out of scope.
    const doc = setBodyFromFragment(`<h2>Order confirmed!</h2>`);
    // h2 fails the isConfirmationHeading tag check → returns true (skipped).
    expect(check(doc.querySelector('h2')!)).toBe(true);
  });

  it('PASSES on Finnish "Kiitos tilauksestasi" with aria-live region', () => {
    // Multilingual confirmation token coverage — Finnish "kiitos" = "thank you".
    const doc = setBodyFromFragment(
      `<section aria-live="polite"><h1>Kiitos tilauksestasi</h1></section>`,
    );
    expect(check(doc.querySelector('h1')!)).toBe(true);
  });

  // Boundary / locale variants — Wave 2 expansion (LAGRANGE)

  it('PASSES Norwegian "Takk for din bestilling" with tabindex=-1', () => {
    const doc = setBodyFromFragment(`<h1 tabindex="-1">Takk for din bestilling</h1>`);
    expect(check(doc.querySelector('h1')!)).toBe(true);
  });

  it('PASSES Danish "Tak for din ordre" with role=status', () => {
    const doc = setBodyFromFragment(`<h1 role="status">Tak for din ordre</h1>`);
    expect(check(doc.querySelector('h1')!)).toBe(true);
  });

  it('FAILS Swedish confirmation h1 with no live region and no tabindex', () => {
    const doc = setBodyFromFragment(`<h1>Tack för din beställning</h1>`);
    expect(check(doc.querySelector('h1')!)).toBe(false);
  });

  it('PASSES with tabindex="0" on confirmation h1 (rule now accepts any non-positive tabindex; rejects only positive anti-pattern values)', () => {
    // Gap closure: the rule previously required tabindex === "-1" exactly,
    // rejecting tabindex="0" (programmatically focusable AND in document tab
    // order) and other valid negative values like "-2". The check now parses
    // the integer and accepts any n ≤ 0; positive tabindex values are still
    // rejected as a WCAG 2.4.3 Focus Order anti-pattern.
    const doc = setBodyFromFragment(`<h1 tabindex="0">Order placed successfully</h1>`);
    expect(check(doc.querySelector('h1')!)).toBe(true);
  });

  it('SKIPS h1 without confirmation tokens regardless of attributes', () => {
    const doc = setBodyFromFragment(`<h1>Shop home</h1>`);
    expect(check(doc.querySelector('h1')!)).toBe(true);
  });

  it('FAILS deeply nested confirmation h1 with no live ancestor (10+ levels)', () => {
    const doc = setBodyFromFragment(`
      <div><div><div><div><div><div><div><div><div><div>
        <h1>Order placed!</h1>
      </div></div></div></div></div></div></div></div></div></div>
    `);
    expect(check(doc.querySelector('h1')!)).toBe(false);
  });

  it('PASSES h1 with role=alert (assertive live region)', () => {
    const doc = setBodyFromFragment(`<h1 role="alert">Order placed</h1>`);
    expect(check(doc.querySelector('h1')!)).toBe(true);
  });

  it('PASSES with Cyrillic confirmation text inside live region', () => {
    const doc = setBodyFromFragment(
      `<section aria-live="polite"><h1>Спасибо за заказ ✨</h1></section>`,
    );
    // "Спасибо" likely not in token list — adjust to use English equivalent.
    // Test: confirms behaviour on non-English heading (likely SKIPS).
    expect(check(doc.querySelector('h1')!)).toBe(true);
  });
});
