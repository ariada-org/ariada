// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { describe, it, expect, beforeEach } from 'vitest';

import { setBodyFromFragment, resetBody } from '../../test-utils.js';

import { check } from './transaction-amount-input.js';

describe('banking/transaction-amount-input — check', () => {
  beforeEach(() => resetBody());

  it('FAILS without inputmode and without currency', () => {
    const document = setBodyFromFragment(
      `<label for="amt">Amount</label><input type="text" id="amt" name="amount">`,
    );
    expect(check(document.querySelector('#amt')!)).toBe(false);
  });

  it('PASSES with inputmode=decimal and currency in label', () => {
    const document = setBodyFromFragment(
      `<input type="text" name="amount" aria-label="Amount in SEK" inputmode="decimal">`,
    );
    expect(check(document.querySelector('input')!)).toBe(true);
  });

  it('PASSES with type=number and currency aria-describedby', () => {
    const document = setBodyFromFragment(`
      <input type="number" name="belopp" aria-describedby="cur">
      <span id="cur">SEK</span>
    `);
    expect(check(document.querySelector('input')!)).toBe(true);
  });

  it('FAILS without currency context (only inputmode)', () => {
    const document = setBodyFromFragment(
      `<input type="text" name="amount" inputmode="decimal" aria-label="Amount">`,
    );
    expect(check(document.querySelector('input')!)).toBe(false);
  });

  it('PASSES Swedish "belopp" with kronor', () => {
    const document = setBodyFromFragment(
      `<input type="number" name="belopp" aria-label="Belopp i kronor">`,
    );
    expect(check(document.querySelector('input')!)).toBe(true);
  });

  it('SKIPS non-amount inputs', () => {
    const document = setBodyFromFragment(`<input type="text" name="username">`);
    expect(check(document.querySelector('input')!)).toBe(true);
  });

  // Edge cases

  it('PASSES with inputmode="numeric" (integer-only mobile keyboard)', () => {
    // Rule accepts both decimal and numeric inputmode values.
    const document = setBodyFromFragment(
      `<input type="text" name="amount" aria-label="Amount in EUR" inputmode="numeric">`,
    );
    expect(check(document.querySelector('input')!)).toBe(true);
  });

  it('PASSES with Danish "DKK" currency token in aria-label', () => {
    // CURRENCY_TOKEN_RE covers Nordic currency codes via /\b(sek|eur|nok|dkk|...)/i.
    // Note: regex uses \b around the alternation; literal symbols like "€" / "$" fail
    // \b on both sides (non-word chars). Real-world labels should prefer ISO codes
    // (EUR/SEK/DKK) until the regex is widened to recognise symbol-adjacent boundaries.
    const document = setBodyFromFragment(
      `<input type="number" name="amount" aria-label="Beløb i DKK">`,
    );
    expect(check(document.querySelector('input')!)).toBe(true);
  });

  // Boundary and locale variants

  it('PASSES Norwegian "beløp" with NOK currency in aria-describedby', () => {
    const document = setBodyFromFragment(`
      <input type="number" name="beløp" aria-describedby="cur">
      <span id="cur">Valuta: NOK</span>
    `);
    expect(check(document.querySelector('input')!)).toBe(true);
  });

  it('PASSES Finnish "määrä" with EUR in aria-label', () => {
    const document = setBodyFromFragment(
      `<input type="number" name="määrä" aria-label="Määrä EUR">`,
    );
    expect(check(document.querySelector('input')!)).toBe(true);
  });

  it('PASSES with type="tel" + inputmode=decimal + SEK', () => {
    const document = setBodyFromFragment(
      `<input type="tel" name="amount" inputmode="decimal" aria-label="Amount SEK">`,
    );
    expect(check(document.querySelector('input')!)).toBe(true);
  });

  it('FAILS amount input with NO inputmode and only currency (still needs inputmode)', () => {
    const document = setBodyFromFragment(
      `<input type="text" name="amount" aria-label="Amount in SEK">`,
    );
    expect(check(document.querySelector('input')!)).toBe(false);
  });

  it('SKIPS amount input with type="hidden" (not in accepted types)', () => {
    const document = setBodyFromFragment(
      `<input type="hidden" name="amount" aria-label="Amount SEK">`,
    );
    expect(check(document.querySelector('input')!)).toBe(true);
  });

  it('SKIPS amount input with type="checkbox"', () => {
    const document = setBodyFromFragment(
      `<input type="checkbox" name="amount">`,
    );
    expect(check(document.querySelector('input')!)).toBe(true);
  });

  it('PASSES with multiple aria-describedby IDs (one mentions currency)', () => {
    const document = setBodyFromFragment(`
      <input type="number" name="amount" aria-describedby="hint cur">
      <span id="hint">Enter integer</span>
      <span id="cur">In SEK</span>
    `);
    expect(check(document.querySelector('input')!)).toBe(true);
  });

  it('FAILS with broken aria-describedby (non-existent IDs only)', () => {
    const document = setBodyFromFragment(
      `<input type="number" name="amount" aria-describedby="missing">`,
    );
    expect(check(document.querySelector('input')!)).toBe(false);
  });

  it('PASSES with Cyrillic aria-label mentioning EUR', () => {
    const document = setBodyFromFragment(
      `<input type="number" name="amount" aria-label="Сумма в EUR">`,
    );
    expect(check(document.querySelector('input')!)).toBe(true);
  });

  it('SKIPS non-amount name "search"', () => {
    const document = setBodyFromFragment(
      `<input type="number" name="search">`,
    );
    expect(check(document.querySelector('input')!)).toBe(true);
  });

  it('PASSES uppercase INPUTMODE attribute (case-insensitive HTML)', () => {
    const document = setBodyFromFragment(
      `<input type="text" name="amount" INPUTMODE="decimal" aria-label="Amount SEK">`,
    );
    expect(check(document.querySelector('input')!)).toBe(true);
  });
});
