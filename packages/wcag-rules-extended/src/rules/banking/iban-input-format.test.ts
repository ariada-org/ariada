// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { describe, it, expect, beforeEach } from 'vitest';

import { setBodyFromFragment, resetBody } from '../../test-utils.js';

import { check } from './iban-input-format.js';

describe('banking/iban-input-format — check', () => {
  beforeEach(() => resetBody());

  it('FAILS without format hint', () => {
    const doc = setBodyFromFragment(`<input type="text" name="iban" aria-label="IBAN">`);
    expect(check(doc.querySelector('input')!)).toBe(false);
  });

  it('PASSES with segmented placeholder', () => {
    const doc = setBodyFromFragment(
      `<input type="text" name="iban" aria-label="IBAN" placeholder="SE45 5000 0000 0583 9825 7466">`,
    );
    expect(check(doc.querySelector('input')!)).toBe(true);
  });

  it('PASSES with Finnish IBAN format placeholder', () => {
    const doc = setBodyFromFragment(
      `<input type="text" name="iban" aria-label="IBAN" placeholder="FI21 1234 5600 0007 85">`,
    );
    expect(check(doc.querySelector('input')!)).toBe(true);
  });

  it('PASSES with aria-describedby format reference', () => {
    const doc = setBodyFromFragment(`
      <input type="text" name="iban" aria-label="IBAN account number" aria-describedby="fmt">
      <span id="fmt">Format: SE45 5000 0000 0583 9825 7466</span>
    `);
    expect(check(doc.querySelector('input')!)).toBe(true);
  });

  it('SKIPS non-IBAN inputs', () => {
    const doc = setBodyFromFragment(`<input type="text" name="account">`);
    expect(check(doc.querySelector('input')!)).toBe(true);
  });

  // Edge cases — Phase 1C revision

  it('PASSES when IBAN input uses type="tel" (mobile numeric optimization)', () => {
    // looksLikeIbanInput accepts text|tel — both valid for IBAN entry.
    const doc = setBodyFromFragment(
      `<input type="tel" name="iban" aria-label="IBAN" placeholder="SE45 5000 0000 0583 9825 7466">`,
    );
    expect(check(doc.querySelector('input')!)).toBe(true);
  });

  it('FAILS when placeholder has IBAN-like prefix but too few segments', () => {
    // SEGMENTED_FORMAT_RE requires at least 2 trailing segments after the country prefix.
    const doc = setBodyFromFragment(
      `<input type="text" name="iban" aria-label="IBAN" placeholder="SE45 5000">`,
    );
    expect(check(doc.querySelector('input')!)).toBe(false);
  });

  // Boundary / locale variants — Wave 2 expansion (LAGRANGE)

  it('SKIPS type="number" (not in accepted-types list)', () => {
    const doc = setBodyFromFragment(
      `<input type="number" name="iban" aria-label="IBAN">`,
    );
    expect(check(doc.querySelector('input')!)).toBe(true);
  });

  it('SKIPS type="password" IBAN-named input', () => {
    const doc = setBodyFromFragment(
      `<input type="password" name="iban" aria-label="IBAN">`,
    );
    expect(check(doc.querySelector('input')!)).toBe(true);
  });

  it('PASSES Norwegian IBAN format NO93 8601 1117 947', () => {
    const doc = setBodyFromFragment(
      `<input type="text" name="iban" aria-label="IBAN" placeholder="NO93 8601 1117 947">`,
    );
    expect(check(doc.querySelector('input')!)).toBe(true);
  });

  it('PASSES Danish IBAN format DK50 0040 0440 1162 43', () => {
    const doc = setBodyFromFragment(
      `<input type="text" name="iban" aria-label="IBAN" placeholder="DK50 0040 0440 1162 43">`,
    );
    expect(check(doc.querySelector('input')!)).toBe(true);
  });

  it('PASSES IBAN-id-only input with format hint (loosened guard accepts id/name match in addition to accessible name)', () => {
    // Gap closure: previously check() required /\biban\b/i in accessible name
    // even when looksLikeIbanInput had matched via the id. That double-guard
    // rejected inputs whose label said "Bank account" but whose id="my-iban"
    // already surfaces the IBAN semantic to AT via the for→id association.
    // The strict accName re-check has been loosened to accept accName OR
    // id OR name attribute containing the IBAN token.
    const doc = setBodyFromFragment(`
      <label for="my-iban">Bank account</label>
      <input type="text" id="my-iban" placeholder="SE45 5000 0000 0583 9825 7466">
    `);
    expect(check(doc.querySelector('input')!)).toBe(true);
  });

  it('SKIPS input with substring "ibank" (word-boundary regex)', () => {
    // /\biban\b/ should NOT match "ibank" or "iibanian".
    const doc = setBodyFromFragment(
      `<input type="text" name="ibank-id" aria-label="iBank ID">`,
    );
    expect(check(doc.querySelector('input')!)).toBe(true);
  });

  it('FAILS IBAN input with aria-describedby pointing to missing element', () => {
    // Broken aria-describedby reference → no fallback hint → fail.
    const doc = setBodyFromFragment(
      `<input type="text" name="iban" aria-label="IBAN" aria-describedby="nonexistent">`,
    );
    expect(check(doc.querySelector('input')!)).toBe(false);
  });

  it('PASSES IBAN with multiple aria-describedby IDs (one valid)', () => {
    const doc = setBodyFromFragment(`
      <input type="text" name="iban" aria-label="IBAN" aria-describedby="warning fmt">
      <span id="warning">Required field</span>
      <span id="fmt">FI21 1234 5600 0007 85</span>
    `);
    expect(check(doc.querySelector('input')!)).toBe(true);
  });

  it('PASSES with deeply nested aria-describedby (10+ ancestor levels)', () => {
    const doc = setBodyFromFragment(`
      <input type="text" name="iban" aria-label="IBAN" aria-describedby="fmt">
      <div><div><div><div><div><div><div><div><div><div>
        <span id="fmt">SE45 5000 0000 0583 9825 7466</span>
      </div></div></div></div></div></div></div></div></div></div>
    `);
    expect(check(doc.querySelector('input')!)).toBe(true);
  });

  it('FAILS IBAN with emoji-only aria-label (no "IBAN" word match)', () => {
    // looksLikeIbanInput requires literal "iban" word — emoji alone doesn't match.
    const doc = setBodyFromFragment(
      `<input type="text" aria-label="💳 Bank">`,
    );
    expect(check(doc.querySelector('input')!)).toBe(true); // skips, not IBAN
  });

  it('PASSES IBAN input with Cyrillic aria-label containing word "iban"', () => {
    const doc = setBodyFromFragment(
      `<input type="text" aria-label="Введите IBAN номер счёта" placeholder="SE45 5000 0000 0583 9825 7466">`,
    );
    expect(check(doc.querySelector('input')!)).toBe(true);
  });
});
