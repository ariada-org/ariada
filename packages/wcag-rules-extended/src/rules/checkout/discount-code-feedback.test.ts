// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { describe, it, expect, beforeEach } from 'vitest';

import { setBodyFromFragment, resetBody } from '../../test-utils.js';

import { check } from './discount-code-feedback.js';

describe('checkout/discount-code-feedback — check', () => {
  beforeEach(() => resetBody());

  it('FAILS when discount input has no feedback region', () => {
    const doc = setBodyFromFragment(`
      <label for="promo">Promo code</label>
      <input type="text" id="promo" name="promo">
    `);
    expect(check(doc.querySelector('#promo')!)).toBe(false);
  });

  it('PASSES when input aria-describedby points to role=status', () => {
    const doc = setBodyFromFragment(`
      <label for="promo">Promo code</label>
      <input type="text" id="promo" name="promo" aria-describedby="promo-fb">
      <div id="promo-fb" role="status"></div>
    `);
    expect(check(doc.querySelector('#promo')!)).toBe(true);
  });

  it('PASSES when input aria-describedby points to aria-live region', () => {
    const doc = setBodyFromFragment(`
      <input type="text" name="coupon" aria-describedby="coupon-msg">
      <span id="coupon-msg" aria-live="polite"></span>
    `);
    expect(check(doc.querySelector('input')!)).toBe(true);
  });

  it('PASSES when ancestor has aria-live', () => {
    const doc = setBodyFromFragment(`
      <div aria-live="polite">
        <input type="text" name="voucher">
      </div>
    `);
    expect(check(doc.querySelector('input')!)).toBe(true);
  });

  it('PASSES Swedish "kupong" with feedback region', () => {
    const doc = setBodyFromFragment(`
      <input type="text" name="kupong" aria-describedby="fb">
      <div id="fb" role="status"></div>
    `);
    expect(check(doc.querySelector('input')!)).toBe(true);
  });

  it('SKIPS non-discount fields', () => {
    const doc = setBodyFromFragment(`<input type="text" name="email">`);
    expect(check(doc.querySelector('input')!)).toBe(true);
  });

  // Edge cases — Phase 1C revision

  it('FAILS when aria-describedby references a region without live/status role', () => {
    // Plain <div> with no role + no aria-live — feedback won't be announced.
    const doc = setBodyFromFragment(`
      <input type="text" name="promo" aria-describedby="hint">
      <div id="hint">Enter code</div>
    `);
    expect(check(doc.querySelector('input')!)).toBe(false);
  });

  it('PASSES when aria-describedby targets a role="alert" region', () => {
    // role="alert" implies aria-live="assertive" by default — feedback will be announced.
    const doc = setBodyFromFragment(`
      <input type="text" name="discount" aria-describedby="alert-id">
      <div id="alert-id" role="alert"></div>
    `);
    expect(check(doc.querySelector('input')!)).toBe(true);
  });

  // Boundary / locale variants — Wave 2 expansion (LAGRANGE)

  it('FAILS Norwegian "rabattkode" compound (Unicode-aware lookbehind matches start-of-token "rabatt" without trailing boundary)', () => {
    // Gap closure: the discount-token regex now uses a Unicode-aware
    // negative-lookbehind `(?<![\\p{L}\\d_])` instead of `\\b` so Nordic
    // compounds like "rabattkode" / "rabattkod" / "alennuskoodi" match the
    // leading token. Without a feedback region the rule now correctly fails.
    const doc = setBodyFromFragment(`
      <label for="r">Rabattkode</label>
      <input type="text" id="r" name="rabattkode">
    `);
    expect(check(doc.querySelector('#r')!)).toBe(false);
  });

  it('FAILS Norwegian "rabatt" (bare word, matches token, no feedback)', () => {
    const doc = setBodyFromFragment(`
      <label for="r">Rabatt</label>
      <input type="text" id="r" name="rabatt">
    `);
    expect(check(doc.querySelector('#r')!)).toBe(false);
  });

  it('PASSES Finnish "alennuskoodi" compound with live feedback region (lookbehind matches "alennus" leading-token; aria-live target satisfies feedback)', () => {
    // Gap closure: "alennus" is now matched in the compound "alennuskoodi"
    // via the Unicode-aware lookbehind. The presence of a live region keeps
    // the rule passing — this test pins the compound-detection win.
    const doc = setBodyFromFragment(`
      <input type="text" name="alennuskoodi" aria-describedby="fb">
      <div id="fb" aria-live="polite"></div>
    `);
    expect(check(doc.querySelector('input')!)).toBe(true);
  });

  it('PASSES bare "alennus" name with aria-live region', () => {
    const doc = setBodyFromFragment(`
      <input type="text" name="alennus" aria-describedby="fb">
      <div id="fb" aria-live="polite"></div>
    `);
    expect(check(doc.querySelector('input')!)).toBe(true);
  });

  it('PASSES Danish "rabatkode" compound with status feedback (single-t Danish form "rabat" added to alternation; lookbehind matches in compound)', () => {
    // Gap closure: Danish spells the word with single "t" — "rabat" / "rabatkode".
    // The alternation now includes `rabat` (after `rabatt` so left-to-right
    // priority keeps Swedish/Norwegian "rabatten" matching as "rabatt"), so
    // Danish forms are detected. With role=status the rule passes.
    const doc = setBodyFromFragment(`
      <input type="text" name="rabatkode" aria-describedby="fb">
      <div id="fb" role="status"></div>
    `);
    expect(check(doc.querySelector('input')!)).toBe(true);
  });

  it('FAILS when aria-describedby references multiple non-live regions', () => {
    const doc = setBodyFromFragment(`
      <input type="text" name="promo" aria-describedby="hint help">
      <div id="hint">Enter code</div>
      <div id="help">Codes are case-sensitive</div>
    `);
    expect(check(doc.querySelector('input')!)).toBe(false);
  });

  it('PASSES when aria-describedby IDs include one live + one non-live', () => {
    const doc = setBodyFromFragment(`
      <input type="text" name="promo" aria-describedby="hint fb">
      <div id="hint">Enter code</div>
      <div id="fb" role="status"></div>
    `);
    expect(check(doc.querySelector('input')!)).toBe(true);
  });

  it('PASSES deeply nested under aria-live ancestor (10+ levels)', () => {
    const doc = setBodyFromFragment(`
      <div aria-live="polite">
        <div><div><div><div><div><div><div><div><div>
          <input type="text" name="voucher">
        </div></div></div></div></div></div></div></div></div>
      </div>
    `);
    expect(check(doc.querySelector('input')!)).toBe(true);
  });

  it('SKIPS unrelated text input named "search"', () => {
    const doc = setBodyFromFragment(`<input type="text" name="search">`);
    expect(check(doc.querySelector('input')!)).toBe(true);
  });

  it('FAILS with aria-describedby pointing to broken IDs (none exist)', () => {
    const doc = setBodyFromFragment(
      `<input type="text" name="promo" aria-describedby="ghost-1 ghost-2">`,
    );
    expect(check(doc.querySelector('input')!)).toBe(false);
  });
});
