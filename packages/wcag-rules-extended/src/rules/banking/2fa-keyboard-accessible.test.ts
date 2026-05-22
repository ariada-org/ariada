// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { describe, it, expect, beforeEach } from 'vitest';

import { setBodyFromFragment, resetBody } from '../../test-utils.js';

import { check } from './2fa-keyboard-accessible.js';

describe('banking/2fa-keyboard-accessible — check', () => {
  beforeEach(() => resetBody());

  const sixInputs = (extra = '') => `
    <form><div class="code">
      <input type="text" maxlength="1" ${extra}>
      <input type="text" maxlength="1" ${extra}>
      <input type="text" maxlength="1" ${extra}>
      <input type="text" maxlength="1" ${extra}>
      <input type="text" maxlength="1" ${extra}>
      <input type="text" maxlength="1" ${extra}>
    </div></form>
  `;

  it('PASSES baseline 6-input 2FA row', () => {
    const document = setBodyFromFragment(sixInputs());
    expect(check(document.querySelector('input')!)).toBe(true);
  });

  it('FAILS when input has tabindex=-1', () => {
    const document = setBodyFromFragment(sixInputs('tabindex="-1"'));
    expect(check(document.querySelector('input')!)).toBe(false);
  });

  it('FAILS when input has inputmode=none', () => {
    const document = setBodyFromFragment(sixInputs('inputmode="none"'));
    expect(check(document.querySelector('input')!)).toBe(false);
  });

  it('FAILS when input is readonly', () => {
    const document = setBodyFromFragment(sixInputs('readonly'));
    expect(check(document.querySelector('input')!)).toBe(false);
  });

  it('SKIPS short rows (<3 maxlength=1 inputs)', () => {
    const document = setBodyFromFragment(`
      <input type="text" maxlength="1" tabindex="-1">
      <input type="text" maxlength="1" tabindex="-1">
    `);
    expect(check(document.querySelector('input')!)).toBe(true);
  });

  it('SKIPS unrelated inputs', () => {
    const document = setBodyFromFragment(`<input type="text">`);
    expect(check(document.querySelector('input')!)).toBe(true);
  });

  // Edge cases

  it('PASSES baseline 6-input row with type="tel" (mobile numeric keyboard)', () => {
    // looksLike2faInput accepts text|tel|number — verify tel variant.
    const document = setBodyFromFragment(`
      <form><div class="code">
        <input type="tel" maxlength="1">
        <input type="tel" maxlength="1">
        <input type="tel" maxlength="1">
        <input type="tel" maxlength="1">
        <input type="tel" maxlength="1">
        <input type="tel" maxlength="1">
      </div></form>
    `);
    expect(check(document.querySelector('input')!)).toBe(true);
  });

  it('SKIPS when inputs are not siblings (maxlength=1 but scattered)', () => {
    // looksLike2faInput counts siblings in same parent — scattered inputs disqualify.
    const document = setBodyFromFragment(`
      <form>
        <div><input type="text" maxlength="1"></div>
        <div><input type="text" maxlength="1"></div>
        <div><input type="text" maxlength="1"></div>
        <div><input type="text" maxlength="1"></div>
      </form>
    `);
    // First input's parent has only 1 maxlength=1 sibling → siblings.length < 3 → skipped.
    expect(check(document.querySelector('input')!)).toBe(true);
  });

  // Boundary cases

  it('SKIPS exactly 2 maxlength=1 inputs (below threshold of 3 siblings)', () => {
    // Threshold is siblings.length >= 3 — exactly 2 must not trigger the 2FA pattern.
    const document = setBodyFromFragment(`
      <form><div>
        <input type="text" maxlength="1" tabindex="-1">
        <input type="text" maxlength="1" tabindex="-1">
      </div></form>
    `);
    expect(check(document.querySelector('input')!)).toBe(true);
  });

  it('FIRES at exactly 3 maxlength=1 inputs (boundary threshold)', () => {
    // siblings.length === 3 is the inclusive boundary — must fire.
    const document = setBodyFromFragment(`
      <form><div>
        <input type="text" maxlength="1" tabindex="-1">
        <input type="text" maxlength="1" tabindex="-1">
        <input type="text" maxlength="1" tabindex="-1">
      </div></form>
    `);
    expect(check(document.querySelector('input')!)).toBe(false);
  });

  it('PASSES with 12+ maxlength=1 inputs (recovery code, deep row)', () => {
    // Some banks use 12-char one-time backup codes — same rule must apply.
    const document = setBodyFromFragment(`
      <form><div class="recovery-code">
        ${Array(12).fill('<input type="text" maxlength="1">').join('')}
      </div></form>
    `);
    expect(check(document.querySelector('input')!)).toBe(true);
  });

  it('FAILS at very deep DOM nesting (10+ ancestor levels)', () => {
    // Rule reads from node.parentElement only — deep wrapping should not affect detection.
    const inputs = Array(6).fill('<input type="text" maxlength="1" tabindex="-1">').join('');
    const document = setBodyFromFragment(
      `<div><div><div><div><div><div><div><div><div><div><div>${inputs}</div></div></div></div></div></div></div></div></div></div></div>`,
    );
    expect(check(document.querySelector('input')!)).toBe(false);
  });

  it('FAILS with type="number" 2FA row (number is in accepted types list)', () => {
    // looksLike2faInput accepts text|tel|number — number variant must also fire on tabindex=-1.
    const document = setBodyFromFragment(`
      <form><div>
        <input type="number" maxlength="1" tabindex="-1">
        <input type="number" maxlength="1" tabindex="-1">
        <input type="number" maxlength="1" tabindex="-1">
        <input type="number" maxlength="1" tabindex="-1">
      </div></form>
    `);
    expect(check(document.querySelector('input')!)).toBe(false);
  });

  it('SKIPS type="password" (not in accepted-types list)', () => {
    // Password type often used for PINs but rule excludes it — must skip.
    const document = setBodyFromFragment(`
      <form><div>
        <input type="password" maxlength="1" tabindex="-1">
        <input type="password" maxlength="1" tabindex="-1">
        <input type="password" maxlength="1" tabindex="-1">
        <input type="password" maxlength="1" tabindex="-1">
      </div></form>
    `);
    expect(check(document.querySelector('input')!)).toBe(true);
  });

  it('FAILS when input has both tabindex=-1 AND readonly (multiple failures still fail)', () => {
    // Both failure conditions present — must report false, not error.
    const document = setBodyFromFragment(sixInputs('tabindex="-1" readonly'));
    expect(check(document.querySelector('input')!)).toBe(false);
  });

  it('PASSES with tabindex="0" explicit (positive tabindex still focusable)', () => {
    // Only tabindex="-1" disqualifies — tabindex="0" or positive values pass.
    const document = setBodyFromFragment(sixInputs('tabindex="0"'));
    expect(check(document.querySelector('input')!)).toBe(true);
  });

  it('PASSES with inputmode="numeric" (only "none" is forbidden)', () => {
    // Rule only forbids inputmode="none" — numeric/decimal/tel must pass.
    const document = setBodyFromFragment(sixInputs('inputmode="numeric"'));
    expect(check(document.querySelector('input')!)).toBe(true);
  });

  it('PASSES with Cyrillic aria-label on 2FA input (Unicode-safe)', () => {
    // Confirms accessible-name path doesn't barf on non-ASCII.
    const document = setBodyFromFragment(`
      <form><div>
        <input type="text" maxlength="1" aria-label="Код подтверждения цифра 1">
        <input type="text" maxlength="1" aria-label="Код подтверждения цифра 2">
        <input type="text" maxlength="1" aria-label="Код подтверждения цифра 3">
        <input type="text" maxlength="1" aria-label="Код подтверждения цифра 4">
      </div></form>
    `);
    expect(check(document.querySelector('input')!)).toBe(true);
  });

  it('FAILS uppercase READONLY attribute value (case-insensitive HTML attribute)', () => {
    // HTML attributes are case-insensitive; readonly without value still applies.
    const document = setBodyFromFragment(sixInputs('READONLY'));
    expect(check(document.querySelector('input')!)).toBe(false);
  });

  it('Reports first matching input only when called per-element (selector-driven)', () => {
    // The rule selector "input[maxlength=1]" matches all six; each independent eval.
    const document = setBodyFromFragment(sixInputs('tabindex="-1"'));
    const allInputs = Array.from(document.querySelectorAll('input'));
    expect(allInputs.length).toBe(6);
    // All 6 should report fail under the same condition.
    for (const inp of allInputs) {
      expect(check(inp)).toBe(false);
    }
  });

  it('PASSES with inputmode="decimal" (decimal also valid for 2FA)', () => {
    const document = setBodyFromFragment(sixInputs('inputmode="decimal"'));
    expect(check(document.querySelector('input')!)).toBe(true);
  });
});
