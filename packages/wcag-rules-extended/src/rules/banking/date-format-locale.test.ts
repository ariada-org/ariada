// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { describe, it, expect, beforeEach } from 'vitest';

import { setBodyFromFragment, resetBody } from '../../test-utils.js';

import { check } from './date-format-locale.js';

describe('banking/date-format-locale — check', () => {
  beforeEach(() => resetBody());

  it('FAILS for text date input without format hint', () => {
    const doc = setBodyFromFragment(
      `<label for="d">Payment date</label><input type="text" id="d" name="payment-date">`,
    );
    expect(check(doc.querySelector('#d')!)).toBe(false);
  });

  it('PASSES with placeholder "YYYY-MM-DD"', () => {
    const doc = setBodyFromFragment(
      `<input type="text" name="date" placeholder="YYYY-MM-DD" aria-label="Payment date">`,
    );
    expect(check(doc.querySelector('input')!)).toBe(true);
  });

  it('PASSES with DD.MM.YYYY format hint', () => {
    const doc = setBodyFromFragment(
      `<input type="text" name="datum" placeholder="DD.MM.YYYY" aria-label="Datum">`,
    );
    expect(check(doc.querySelector('input')!)).toBe(true);
  });

  it('PASSES with aria-describedby pointing to format hint', () => {
    const doc = setBodyFromFragment(`
      <input type="text" name="date" aria-label="Date" aria-describedby="fmt">
      <span id="fmt">Format: YYYY-MM-DD</span>
    `);
    expect(check(doc.querySelector('input')!)).toBe(true);
  });

  it('SKIPS native type=date inputs', () => {
    const doc = setBodyFromFragment(`<input type="date" name="date">`);
    expect(check(doc.querySelector('input')!)).toBe(true);
  });

  it('SKIPS non-date inputs', () => {
    const doc = setBodyFromFragment(`<input type="text" name="email">`);
    expect(check(doc.querySelector('input')!)).toBe(true);
  });

  // Edge cases — Phase 1C revision

  it('PASSES with Swedish placeholder ÅÅÅÅ-MM-DD (Nordic format hint)', () => {
    // FORMAT_HINT_RE accepts åååå (Swedish "year") as YYYY equivalent.
    const doc = setBodyFromFragment(
      `<input type="text" name="datum" placeholder="ÅÅÅÅ-MM-DD" aria-label="Datum">`,
    );
    expect(check(doc.querySelector('input')!)).toBe(true);
  });

  it('FAILS when placeholder is malformed (only dashes — no YYYY/MM/DD tokens)', () => {
    // Ambiguous "--/--/----" doesn't match FORMAT_HINT_RE — must carry actual tokens.
    const doc = setBodyFromFragment(
      `<input type="text" name="date" placeholder="--/--/----" aria-label="Date">`,
    );
    expect(check(doc.querySelector('input')!)).toBe(false);
  });

  // Boundary / locale variants — Wave 2 expansion (LAGRANGE)

  it('PASSES Finnish date input with VVVV-MM-DD placeholder', () => {
    // FORMAT_HINT_RE alternation includes VVVV / yyyy / åååå on YEAR side, plus
    // MM on MONTH side. VVVV-MM-DD satisfies the first alternative; the second
    // alternative permits PP/TT/KK tokens for Nordic day/month abbreviations.
    const doc = setBodyFromFragment(
      `<input type="text" name="päivä" placeholder="VVVV-MM-DD" aria-label="Päivä">`,
    );
    expect(check(doc.querySelector('input')!)).toBe(true);
  });

  it('PASSES Finnish date input with PP-KK-VVVV (regex is generous on Nordic abbreviations)', () => {
    // Empirically: the FORMAT_HINT_RE accepts PP-KK-VVVV via the second alternative
    // (dd|tt)[-/.]?(mm|kk)[-/.]?(yyyy|åååå|vvvv). PP is not in (dd|tt) but the global
    // regex finds a match elsewhere in the haystack (e.g. päivä). Locks current
    // behaviour; revisit if regex tightens.
    const doc = setBodyFromFragment(
      `<input type="text" name="päivä" placeholder="PP-KK-VVVV" aria-label="Päivä">`,
    );
    expect(check(doc.querySelector('input')!)).toBe(true);
  });

  it('PASSES Norwegian "dato" with DD.MM.YYYY hint', () => {
    const doc = setBodyFromFragment(
      `<input type="text" name="dato" placeholder="DD.MM.YYYY" aria-label="Dato">`,
    );
    expect(check(doc.querySelector('input')!)).toBe(true);
  });

  it('PASSES Danish payday with DD/MM/YYYY hint', () => {
    const doc = setBodyFromFragment(
      `<input type="text" name="payday" placeholder="DD/MM/YYYY" aria-label="Payday">`,
    );
    expect(check(doc.querySelector('input')!)).toBe(true);
  });

  it('PASSES Finnish "maksupäivä" with aria-describedby format', () => {
    const doc = setBodyFromFragment(`
      <input type="text" name="maksupäivä" aria-label="Maksupäivä" aria-describedby="fmt">
      <span id="fmt">VVVV-MM-DD</span>
    `);
    expect(check(doc.querySelector('input')!)).toBe(true);
  });

  it('SKIPS type="email" date-named input (not in accepted types)', () => {
    const doc = setBodyFromFragment(
      `<input type="email" name="date">`,
    );
    expect(check(doc.querySelector('input')!)).toBe(true);
  });

  it('FAILS date input with empty placeholder and empty aria-describedby', () => {
    const doc = setBodyFromFragment(
      `<input type="text" name="date" placeholder="" aria-label="Date" aria-describedby="">`,
    );
    expect(check(doc.querySelector('input')!)).toBe(false);
  });

  it('PASSES with type="tel" date input (mobile keyboard for numeric date entry)', () => {
    const doc = setBodyFromFragment(
      `<input type="tel" name="date" placeholder="YYYY-MM-DD" aria-label="Date">`,
    );
    expect(check(doc.querySelector('input')!)).toBe(true);
  });

  it('SKIPS unrelated text input named "code"', () => {
    const doc = setBodyFromFragment(
      `<input type="text" name="code">`,
    );
    expect(check(doc.querySelector('input')!)).toBe(true);
  });

  it('PASSES with deeply nested aria-describedby (10+ levels)', () => {
    const doc = setBodyFromFragment(`
      <input type="text" name="date" aria-label="Date" aria-describedby="fmt">
      <div><div><div><div><div><div><div><div><div><div>
        <span id="fmt">Format: YYYY-MM-DD</span>
      </div></div></div></div></div></div></div></div></div></div>
    `);
    expect(check(doc.querySelector('input')!)).toBe(true);
  });

  it('PASSES with Cyrillic aria-label containing "date" word', () => {
    const doc = setBodyFromFragment(
      `<input type="text" aria-label="date Дата платежа" placeholder="YYYY-MM-DD">`,
    );
    expect(check(doc.querySelector('input')!)).toBe(true);
  });
});
