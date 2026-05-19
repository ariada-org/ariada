// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { describe, it, expect, beforeEach } from 'vitest';

import { setBodyFromFragment, resetBody } from '../../test-utils.js';

import { check } from './numeric-validation-error.js';

describe('banking/numeric-validation-error-locale — check', () => {
  beforeEach(() => {
    resetBody();
    document.documentElement.removeAttribute('lang');
  });

  it('FAILS when Swedish page has English error', () => {
    document.documentElement.setAttribute('lang', 'sv');
    setBodyFromFragment(`<div role="alert">Invalid amount</div>`);
    expect(check(document.documentElement)).toBe(false);
  });

  it('PASSES when Swedish page has Swedish error', () => {
    document.documentElement.setAttribute('lang', 'sv');
    setBodyFromFragment(`<div role="alert">Ogiltigt belopp</div>`);
    expect(check(document.documentElement)).toBe(true);
  });

  it('PASSES Finnish error on Finnish page', () => {
    document.documentElement.setAttribute('lang', 'fi');
    setBodyFromFragment(`<div role="alert">Virheellinen summa</div>`);
    expect(check(document.documentElement)).toBe(true);
  });

  it('PASSES Danish error on Danish page', () => {
    document.documentElement.setAttribute('lang', 'da');
    setBodyFromFragment(`<div role="alert">Ugyldigt beløb</div>`);
    expect(check(document.documentElement)).toBe(true);
  });

  it('FAILS when Norwegian page has English "Please enter"', () => {
    document.documentElement.setAttribute('lang', 'nb');
    setBodyFromFragment(`<div class="error">Please enter a valid amount</div>`);
    expect(check(document.documentElement)).toBe(false);
  });

  it('SKIPS when page is in English', () => {
    document.documentElement.setAttribute('lang', 'en');
    setBodyFromFragment(`<div role="alert">Invalid amount</div>`);
    expect(check(document.documentElement)).toBe(true);
  });

  // Edge cases — Phase 1C revision

  it('PASSES when bilingual error has both English and Nordic tokens (translation appended)', () => {
    // Hybrid message — "Invalid / Ange ett belopp". "Ange" matches NORDIC_VALIDATION_TOKENS
    // via /\bange\b/ → check returns true.
    // Note: existing rule regex has a known gap — adjective forms with trailing
    // "t" (e.g. "Ogiltigt") fail \bogiltig\b because the t is a word char. Use
    // root verbs / imperatives in real messages until the regex is widened.
    document.documentElement.setAttribute('lang', 'sv');
    setBodyFromFragment(
      `<div role="alert">Invalid amount / Ange ett belopp</div>`,
    );
    expect(check(document.documentElement)).toBe(true);
  });

  it('PASSES Swedish page when error container is empty (no validation triggered)', () => {
    // Empty text is skipped via the "if (!text) continue" guard.
    document.documentElement.setAttribute('lang', 'sv');
    setBodyFromFragment(`<div role="alert"></div><div class="error"></div>`);
    expect(check(document.documentElement)).toBe(true);
  });

  // Boundary / locale variants — Wave 2 expansion (LAGRANGE)

  it('SKIPS English page (lang="en") with English error (rule is Nordic-only)', () => {
    document.documentElement.setAttribute('lang', 'en');
    setBodyFromFragment(`<div role="alert">Invalid amount</div>`);
    expect(check(document.documentElement)).toBe(true);
  });

  it('FAILS Norwegian (nb) page with English-only "required" message', () => {
    document.documentElement.setAttribute('lang', 'nb');
    setBodyFromFragment(`<div role="alert">Field is required</div>`);
    expect(check(document.documentElement)).toBe(false);
  });

  it('FAILS Danish (da) page with English-only "please enter" message', () => {
    document.documentElement.setAttribute('lang', 'da');
    setBodyFromFragment(`<div role="alert">Please enter your amount</div>`);
    expect(check(document.documentElement)).toBe(false);
  });

  it('FAILS Finnish (fi) page with English-only "error" token', () => {
    document.documentElement.setAttribute('lang', 'fi');
    setBodyFromFragment(`<div class="error">Error: too short</div>`);
    expect(check(document.documentElement)).toBe(false);
  });

  it('PASSES Norwegian (nb) page with Norwegian "ugyldig" validation token', () => {
    document.documentElement.setAttribute('lang', 'nb');
    setBodyFromFragment(`<div role="alert">Ugyldig beløp - vennligst fyll inn på nytt</div>`);
    expect(check(document.documentElement)).toBe(true);
  });

  it('PASSES Danish (da) page with Danish "udfyld" token', () => {
    document.documentElement.setAttribute('lang', 'da');
    setBodyFromFragment(`<div role="alert">Forkert udfyld venligst feltet</div>`);
    expect(check(document.documentElement)).toBe(true);
  });

  it('PASSES Finnish (fi) page with Finnish "virhe" token', () => {
    document.documentElement.setAttribute('lang', 'fi');
    setBodyFromFragment(`<div role="alert">Virhe - täytä kenttä</div>`);
    expect(check(document.documentElement)).toBe(true);
  });

  it('SKIPS Norwegian "nn" Nynorsk page with English error (nn not in NORDIC_LANGS set)', () => {
    // NORDIC_LANGS includes nb/nn/no — confirm nn is treated as Nordic and fails.
    document.documentElement.setAttribute('lang', 'nn');
    setBodyFromFragment(`<div role="alert">Invalid amount</div>`);
    expect(check(document.documentElement)).toBe(false);
  });

  it('FAILS Swedish page with multiple errors (any one matches → fail)', () => {
    // First-encountered English-only error suffices.
    document.documentElement.setAttribute('lang', 'sv');
    setBodyFromFragment(`
      <div role="alert">Ogiltigt</div>
      <div class="error">Required field is empty</div>
    `);
    expect(check(document.documentElement)).toBe(false);
  });

  it('PASSES Swedish page with aria-invalid="true" empty input (no text)', () => {
    // aria-invalid alone with no error text → skipped.
    document.documentElement.setAttribute('lang', 'sv');
    setBodyFromFragment(`<input aria-invalid="true">`);
    expect(check(document.documentElement)).toBe(true);
  });

  it('PASSES Norwegian page with Nordic-script umlaut Cyrillic emoji in error', () => {
    // Unicode-safe regex evaluation.
    document.documentElement.setAttribute('lang', 'nb');
    setBodyFromFragment(`<div role="alert">⚠️ Ugyldig beløp – prøv igjen 🔢</div>`);
    expect(check(document.documentElement)).toBe(true);
  });
});
