// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { describe, it, expect, beforeEach } from 'vitest';

import { setBodyFromFragment, resetBody } from '../../test-utils.js';

import { check } from './checkout-step-keyboard.js';

describe('checkout/step-keyboard-accessible — check', () => {
  beforeEach(() => resetBody());

  it('FAILS when clickable div step has no tabindex', () => {
    const document = setBodyFromFragment(
      `<div class="checkout-step" onclick="goToStep(2)">Shipping</div>`,
    );
    expect(check(document.querySelector('.checkout-step')!)).toBe(false);
  });

  it('FAILS when role=button on div without tabindex', () => {
    const document = setBodyFromFragment(
      `<div class="stepper-item" role="button">Payment</div>`,
    );
    expect(check(document.querySelector('.stepper-item')!)).toBe(false);
  });

  it('PASSES when step is an <a href>', () => {
    const document = setBodyFromFragment(
      `<a href="#shipping" class="step">Shipping</a>`,
    );
    expect(check(document.querySelector('.step')!)).toBe(true);
  });

  it('PASSES when div step has tabindex=0', () => {
    const document = setBodyFromFragment(
      `<div class="checkout-step" role="button" tabindex="0">Payment</div>`,
    );
    expect(check(document.querySelector('.checkout-step')!)).toBe(true);
  });

  it('PASSES (skip) for static (non-clickable) step indicator', () => {
    const document = setBodyFromFragment(
      `<li class="step">Confirmation</li>`,
    );
    expect(check(document.querySelector('.step')!)).toBe(true);
  });

  it('SKIPS unrelated divs', () => {
    const document = setBodyFromFragment(`<div class="hero">Welcome</div>`);
    expect(check(document.querySelector('.hero')!)).toBe(true);
  });

  // Edge cases

  it('FAILS when clickable step has tabindex="-1" (focusable programmatically but skipped on Tab)', () => {
    // tabindex=-1 is not >= 0 → isFocusable() returns false.
    const document = setBodyFromFragment(
      `<div class="checkout-step" role="button" tabindex="-1">Shipping</div>`,
    );
    expect(check(document.querySelector('.checkout-step')!)).toBe(false);
  });

  it('PASSES when clickable step is a <button> (native focusable)', () => {
    // <button> always focusable — heuristic class hint marks it as a step indicator.
    const document = setBodyFromFragment(
      `<button class="stepper-item" onclick="goToStep(1)">Payment</button>`,
    );
    expect(check(document.querySelector('.stepper-item')!)).toBe(true);
  });

  // Boundary and locale variants

  it('PASSES with positive tabindex=2 on clickable step', () => {
    const document = setBodyFromFragment(
      `<div class="checkout-step" role="button" tabindex="2">Step</div>`,
    );
    expect(check(document.querySelector('.checkout-step')!)).toBe(true);
  });

  it('PASSES <input type=button> as step', () => {
    const document = setBodyFromFragment(
      `<input type="button" class="checkout-step" value="Confirm">`,
    );
    expect(check(document.querySelector('.checkout-step')!)).toBe(true);
  });

  it('SKIPS aside content with no clickable hint', () => {
    const document = setBodyFromFragment(`<aside>Help</aside>`);
    expect(check(document.querySelector('aside')!)).toBe(true);
  });

  it('FAILS clickable span with role=button no tabindex (deeply nested)', () => {
    const document = setBodyFromFragment(`
      <div><div><div><div><div><div><div><div><div><div>
        <span class="checkout-step" role="button">Confirm</span>
      </div></div></div></div></div></div></div></div></div></div>
    `);
    expect(check(document.querySelector('.checkout-step')!)).toBe(false);
  });

  it('PASSES role=button + tabindex=0 with Cyrillic text', () => {
    const document = setBodyFromFragment(
      `<div class="checkout-step" role="button" tabindex="0">Подтвердить</div>`,
    );
    expect(check(document.querySelector('.checkout-step')!)).toBe(true);
  });

  it('SKIPS multiple unrelated divs (selector-driven test)', () => {
    const document = setBodyFromFragment(`
      <div class="banner">A</div>
      <div class="footer">B</div>
      <div class="sidebar">C</div>
    `);
    const banners = Array.from(document.querySelectorAll('div'));
    for (const b of banners) {
      expect(check(b)).toBe(true);
    }
  });

  // Stryker hardening.
  // Note: source-line 49 is `if (tag === 'input' || tag === 'select' || tag === 'textarea') return true;`
  // — a 3-way OR expression in isFocusable(). Each alt is pinned below so any
  // single mutation flips a result.

  it('PASSES <input> step (line-49 OR alt-1: input)', () => {
    // <input class="checkout-step" onclick=...> — input always focusable.
    // Mutation `tag === 'input'` → `false` would flip this PASS → FAIL.
    const document = setBodyFromFragment(
      `<input class="checkout-step" onclick="next()" value="Continue">`,
    );
    expect(check(document.querySelector('.checkout-step')!)).toBe(true);
  });

  it('PASSES <select> step (line-49 OR alt-2: select)', () => {
    // Clickable select in a step indicator pattern — kept focusable by tag check.
    const document = setBodyFromFragment(
      `<select class="checkout-step" onclick="changeStep()"><option>1</option></select>`,
    );
    expect(check(document.querySelector('.checkout-step')!)).toBe(true);
  });

  it('PASSES <textarea> step (line-49 OR alt-3: textarea)', () => {
    // Native focusable — even though textarea is unusual as a "step", focusable
    // tag rule keeps the check passing.
    const document = setBodyFromFragment(
      `<textarea class="checkout-step" role="button"></textarea>`,
    );
    expect(check(document.querySelector('.checkout-step')!)).toBe(true);
  });

  it('FAILS <a> step without href (boundary on hasAttribute)', () => {
    // tag === 'a' && el.hasAttribute('href') — without href, NOT focusable.
    // Mutation `hasAttribute('href')` → `true` would flip this FAIL → PASS.
    const document = setBodyFromFragment(
      `<a class="checkout-step" onclick="next()">Continue</a>`,
    );
    expect(check(document.querySelector('.checkout-step')!)).toBe(false);
  });

  it('FAILS clickable role=link without tabindex', () => {
    // looksClickable → true (role=link). isFocusable → false (no href, no tabindex).
    const document = setBodyFromFragment(
      `<div class="checkout-step" role="link">Next</div>`,
    );
    expect(check(document.querySelector('.checkout-step')!)).toBe(false);
  });

  it('FAILS clickable role=tab without tabindex', () => {
    // looksClickable → role=tab → true. No focusable mechanism → fail.
    const document = setBodyFromFragment(
      `<div class="checkout-step" role="tab">Next</div>`,
    );
    expect(check(document.querySelector('.checkout-step')!)).toBe(false);
  });

  it('FAILS clickable class "interactive" hint without tabindex', () => {
    // looksClickable via class hint regex /\b(clickable|interactive|cursor-pointer)\b/i.
    const document = setBodyFromFragment(
      `<div class="checkout-step interactive">Next</div>`,
    );
    expect(check(document.querySelector('.checkout-step')!)).toBe(false);
  });

  it('FAILS clickable class "cursor-pointer" hint without tabindex', () => {
    const document = setBodyFromFragment(
      `<div class="checkout-step cursor-pointer">Next</div>`,
    );
    expect(check(document.querySelector('.checkout-step')!)).toBe(false);
  });

  it('FAILS clickable class "clickable" hint without tabindex', () => {
    const document = setBodyFromFragment(
      `<div class="checkout-step clickable">Next</div>`,
    );
    expect(check(document.querySelector('.checkout-step')!)).toBe(false);
  });

  it('SKIPS non-step element even with onclick (step gate)', () => {
    // isCheckoutStepIndicator returns false → check returns true (gate).
    // Pins the early-return on line 70.
    const document = setBodyFromFragment(
      `<div class="hero-banner" onclick="cta()">Buy now</div>`,
    );
    expect(check(document.querySelector('.hero-banner')!)).toBe(true);
  });

  it('SKIPS static step indicator (no clickable hint)', () => {
    // isCheckoutStepIndicator true (class includes "step"), looksClickable false → skip.
    // Pins line 71 early-return.
    const document = setBodyFromFragment(
      `<div class="progress-step">Step 2 of 4</div>`,
    );
    expect(check(document.querySelector('.progress-step')!)).toBe(true);
  });

  it('detects step via id="wizard-step-2" (isCheckoutStepIndicator id branch)', () => {
    // Pin id-based detection (not class) — id pattern matches /step/i.
    const document = setBodyFromFragment(
      `<div id="wizard-step-2" onclick="next()">Payment</div>`,
    );
    expect(check(document.querySelector('#wizard-step-2')!)).toBe(false);
  });

  it('detects step via data-role="step" (isCheckoutStepIndicator data-role branch)', () => {
    // Pin data-role attribute detection — the third source consulted.
    const document = setBodyFromFragment(
      `<div data-role="step" onclick="next()">Payment</div>`,
    );
    expect(check(document.querySelector('[data-role="step"]')!)).toBe(false);
  });

  it('FAILS clickable step with tabindex="abc" (NaN parseInt)', () => {
    // Number.parseInt("abc", 10) === NaN → Number.isFinite(NaN) === false → not focusable.
    // Pins the Number.isFinite branch in isFocusable.
    const document = setBodyFromFragment(
      `<div class="checkout-step" role="button" tabindex="abc">Pay</div>`,
    );
    expect(check(document.querySelector('.checkout-step')!)).toBe(false);
  });
});
