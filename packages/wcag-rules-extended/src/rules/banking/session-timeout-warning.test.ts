// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { describe, it, expect, beforeEach } from 'vitest';

import { setBodyFromFragment, resetBody } from '../../test-utils.js';

import { check } from './session-timeout-warning.js';

describe('banking/session-timeout-warning — check', () => {
  beforeEach(() => resetBody());

  it('FAILS when timeout dialog has no extend button', () => {
    const doc = setBodyFromFragment(`
      <div role="alertdialog" id="timeout-warning">
        <p>Your session will expire soon.</p>
        <button>Log out</button>
      </div>
    `);
    expect(check(doc.querySelector('#timeout-warning')!)).toBe(false);
  });

  it('PASSES with "Extend session" button', () => {
    const doc = setBodyFromFragment(`
      <div role="alertdialog" id="session-warning">
        <p>Session timeout</p>
        <button>Extend session</button>
      </div>
    `);
    expect(check(doc.querySelector('#session-warning')!)).toBe(true);
  });

  it('PASSES with "Stay logged in"', () => {
    const doc = setBodyFromFragment(`
      <div class="timeout-modal">
        <p>About to expire</p>
        <button>Stay logged in</button>
      </div>
    `);
    expect(check(doc.querySelector('.timeout-modal')!)).toBe(true);
  });

  it('PASSES Swedish "Fortsätt"', () => {
    const doc = setBodyFromFragment(`
      <div role="dialog" class="session-timeout">
        <p>Din session löper ut snart</p>
        <button>Fortsätt</button>
      </div>
    `);
    expect(check(doc.querySelector('[role="dialog"]')!)).toBe(true);
  });

  it('PASSES Finnish "Jatka"', () => {
    const doc = setBodyFromFragment(`
      <div role="alertdialog" class="inactivity-warning">
        <p>Istunto päättymässä</p>
        <button>Jatka</button>
      </div>
    `);
    expect(check(doc.querySelector('[role="alertdialog"]')!)).toBe(true);
  });

  it('SKIPS unrelated dialogs', () => {
    const doc = setBodyFromFragment(`
      <div role="dialog" class="cookie-banner"><button>OK</button></div>
    `);
    expect(check(doc.querySelector('[role="dialog"]')!)).toBe(true);
  });

  // Edge cases — Phase 1C revision

  it('PASSES when extend action is an <a href> link (not <button>)', () => {
    // Rule queries button | [role="button"] | a[href] — anchor links count.
    const doc = setBodyFromFragment(`
      <div role="alertdialog" class="timeout-warning">
        <p>Session expiring</p>
        <a href="/extend-session">Continue session</a>
      </div>
    `);
    expect(check(doc.querySelector('.timeout-warning')!)).toBe(true);
  });

  it('FAILS when timeout dialog only has unrelated buttons (no extend tokens)', () => {
    // Buttons present but text doesn't match EXTEND_TEXT_RE.
    const doc = setBodyFromFragment(`
      <div role="alertdialog" class="session-timeout">
        <p>Session expiring</p>
        <button>Cancel</button>
        <button>Sign out</button>
      </div>
    `);
    expect(check(doc.querySelector('.session-timeout')!)).toBe(false);
  });

  // Boundary / locale variants — Wave 2 expansion (LAGRANGE)

  it('PASSES Norwegian "fortsett" button (EXTEND_TEXT_RE includes Norwegian Bokmål "fortsett" alongside Danish "fortsætt" and Swedish "fortsätt")', () => {
    // Gap closure: Norwegian Bokmål "fortsett" (no diacritic) added to the
    // EXTEND_TEXT_RE alternation so SE/DK/NO triadic locale coverage is
    // symmetric. Previously the regex only matched DK/SE forms.
    const doc = setBodyFromFragment(`
      <div role="alertdialog" class="session-timeout">
        <p>Økten utløper snart</p>
        <button>Fortsett</button>
      </div>
    `);
    expect(check(doc.querySelector('.session-timeout')!)).toBe(true);
  });

  it('PASSES Danish "forlæng" button', () => {
    const doc = setBodyFromFragment(`
      <div role="alertdialog" class="session-timeout">
        <p>Session udløber snart</p>
        <button>Forlæng session</button>
      </div>
    `);
    expect(check(doc.querySelector('.session-timeout')!)).toBe(true);
  });

  it('PASSES Finnish "pidennä" button', () => {
    const doc = setBodyFromFragment(`
      <div role="alertdialog" class="session-timeout">
        <p>Istunto päättymässä</p>
        <button>Pidennä istuntoa</button>
      </div>
    `);
    expect(check(doc.querySelector('.session-timeout')!)).toBe(true);
  });

  it('PASSES role="button" div with text content (getAccessibleNameLite now reads text content for elements with role=button, mirroring HTML AAM)', () => {
    // Gap closure: getAccessibleNameLite previously only read textContent for
    // native <button>/<a> tags. ARIA role="button" on a generic element
    // (e.g. <div role="button">) is a widely-deployed pattern for custom UI
    // controls; the AT-exposed name comes from textContent the same way. The
    // helper now treats role="button" the same as a native <button> for the
    // textContent fallback.
    const doc = setBodyFromFragment(`
      <div role="alertdialog" class="timeout-warning">
        <p>Expiring</p>
        <div role="button">Continue</div>
      </div>
    `);
    expect(check(doc.querySelector('.timeout-warning')!)).toBe(true);
  });

  it('PASSES with role="button" div carrying aria-label', () => {
    // aria-label is read first by getAccessibleNameLite → "Continue" matches EXTEND_TEXT_RE.
    const doc = setBodyFromFragment(`
      <div role="alertdialog" class="timeout-warning">
        <p>Expiring</p>
        <div role="button" aria-label="Continue session"></div>
      </div>
    `);
    expect(check(doc.querySelector('.timeout-warning')!)).toBe(true);
  });

  it('PASSES input[type=submit] with value (getAccessibleNameLite now reads value attribute for input[type=submit|button|reset], per HTML AAM)', () => {
    // Gap closure: <input type="submit|button|reset"> elements have no
    // textContent — their accessible name source per HTML Accessibility API
    // Mappings is the `value` attribute. The helper now reads it as the
    // final visible-text fallback so common button-input forms are not
    // misreported as nameless.
    const doc = setBodyFromFragment(`
      <div role="alertdialog" class="session-timeout">
        <form>
          <input type="submit" value="Continue session">
        </form>
      </div>
    `);
    expect(check(doc.querySelector('.session-timeout')!)).toBe(true);
  });

  it('PASSES input[type=submit] with aria-label fallback for extend control', () => {
    const doc = setBodyFromFragment(`
      <div role="alertdialog" class="session-timeout">
        <form>
          <input type="submit" aria-label="Continue session" value="OK">
        </form>
      </div>
    `);
    expect(check(doc.querySelector('.session-timeout')!)).toBe(true);
  });

  it('SKIPS class="navigation-banner" (no timeout/inactivity/session-warning tokens)', () => {
    const doc = setBodyFromFragment(`
      <div class="navigation-banner">
        <button>Sign in</button>
      </div>
    `);
    expect(check(doc.querySelector('.navigation-banner')!)).toBe(true);
  });

  it('FAILS Norwegian "utløp"-class timeout with only sign-out button', () => {
    const doc = setBodyFromFragment(`
      <div class="utløps-varsel">
        <p>Økten utløper</p>
        <button>Logg ut</button>
      </div>
    `);
    expect(check(doc.querySelector('.utløps-varsel')!)).toBe(false);
  });

  it('PASSES with deeply nested extend button (10+ levels inside dialog)', () => {
    const doc = setBodyFromFragment(`
      <div role="alertdialog" class="session-timeout">
        <p>Expiring</p>
        <div><div><div><div><div><div><div><div><div><div>
          <button>Extend</button>
        </div></div></div></div></div></div></div></div></div></div>
      </div>
    `);
    expect(check(doc.querySelector('.session-timeout')!)).toBe(true);
  });

  it('PASSES with Cyrillic dialog text + English extend button', () => {
    const doc = setBodyFromFragment(`
      <div role="alertdialog" class="timeout-warning">
        <p>Ваша сессия скоро истечёт</p>
        <button>Continue</button>
      </div>
    `);
    expect(check(doc.querySelector('.timeout-warning')!)).toBe(true);
  });

  it('FAILS dialog with empty buttons (no accessible name)', () => {
    const doc = setBodyFromFragment(`
      <div role="alertdialog" class="session-timeout">
        <p>Expiring</p>
        <button></button>
        <button></button>
      </div>
    `);
    expect(check(doc.querySelector('.session-timeout')!)).toBe(false);
  });
});
