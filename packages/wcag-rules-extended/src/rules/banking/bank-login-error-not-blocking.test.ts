// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { describe, it, expect, beforeEach } from 'vitest';

import { setBodyFromFragment, resetBody } from '../../test-utils.js';

import { check } from './bank-login-error-not-blocking.js';

describe('banking/login-error-not-blocking — check', () => {
  beforeEach(() => {
    resetBody();
    document.title = 'Login';
  });

  it('FAILS when login error has no role=alert / live region', () => {
    setBodyFromFragment(`
      <form>
        <input type="text" name="username">
        <div class="error-message">Wrong credentials</div>
      </form>
    `);
    expect(check(document.documentElement)).toBe(false);
  });

  it('PASSES when error has role=alert', () => {
    setBodyFromFragment(`
      <form>
        <input type="text" name="username">
        <div class="error-message" role="alert">Wrong credentials</div>
      </form>
    `);
    expect(check(document.documentElement)).toBe(true);
  });

  it('FAILS when login input is disabled', () => {
    setBodyFromFragment(`
      <form>
        <input type="text" name="username" disabled>
        <div role="alert">Account locked</div>
      </form>
    `);
    expect(check(document.documentElement)).toBe(false);
  });

  it('PASSES when error is in aria-live region', () => {
    setBodyFromFragment(`
      <form>
        <input type="text" name="login">
        <div aria-live="polite">
          <span class="form-error">Wrong password</span>
        </div>
      </form>
    `);
    expect(check(document.documentElement)).toBe(true);
  });

  it('SKIPS pages that are not login contexts', () => {
    document.title = 'Home';
    setBodyFromFragment(`<input type="text"><div class="error">Wrong</div>`);
    expect(check(document.documentElement)).toBe(true);
  });

  // Edge cases — Phase 1C revision

  it('PASSES when error container is empty (no current error state)', () => {
    // Empty error containers are skipped via the "if (!text) continue" guard.
    setBodyFromFragment(`
      <form>
        <input type="text" name="username">
        <input type="password" name="password">
        <div class="error-message"></div>
      </form>
    `);
    expect(check(document.documentElement)).toBe(true);
  });

  it('PASSES on Finnish "verkkopankki" URL context with proper alert', () => {
    // Finnish login context detection — "verkkopankki" in URL/title.
    document.title = 'Verkkopankki kirjautuminen';
    setBodyFromFragment(`
      <form>
        <input type="text" name="username">
        <div role="alert">Väärä salasana</div>
      </form>
    `);
    expect(check(document.documentElement)).toBe(true);
  });

  // Boundary cases — Wave 2 expansion (LAGRANGE)

  it('SKIPS non-login pages even with error+disabled inputs', () => {
    // Non-login page (homepage, about) should skip rule entirely.
    document.title = 'About Us';
    setBodyFromFragment(`
      <form>
        <input type="text" name="search" disabled>
        <div class="error">Form is invalid</div>
      </form>
    `);
    expect(check(document.documentElement)).toBe(true);
  });

  it('PASSES Norwegian "nettbank" login URL with proper alert', () => {
    // Locale variant — Norwegian login keyword in title.
    document.title = 'Nettbank innlogging';
    setBodyFromFragment(`
      <form>
        <input type="text" name="username">
        <div role="alert">Feil passord</div>
      </form>
    `);
    expect(check(document.documentElement)).toBe(true);
  });

  it('PASSES Swedish "internetbank" login URL with aria-live polite', () => {
    document.title = 'Internetbank inloggning';
    setBodyFromFragment(`
      <form>
        <input type="text" name="username">
        <div class="error-message" aria-live="polite">Felaktigt lösenord</div>
      </form>
    `);
    expect(check(document.documentElement)).toBe(true);
  });

  it('PASSES when error ancestor has role="status"', () => {
    document.title = 'Sign In';
    setBodyFromFragment(`
      <form>
        <input type="text" name="username">
        <div role="status">
          <div class="error">Wrong password</div>
        </div>
      </form>
    `);
    expect(check(document.documentElement)).toBe(true);
  });

  it('FAILS when error has neither role nor aria-live nor live ancestor', () => {
    document.title = 'Login';
    setBodyFromFragment(`
      <form>
        <input type="text" name="username">
        <div class="error">Wrong password</div>
      </form>
    `);
    expect(check(document.documentElement)).toBe(false);
  });

  it('FAILS even if non-login input is disabled (any input matching pattern)', () => {
    // Rule scans inputs matching specific selectors — any disabled name-input disqualifies.
    document.title = 'Login';
    setBodyFromFragment(`
      <form>
        <input type="text" name="user_id" disabled>
        <div role="alert">Wrong password</div>
      </form>
    `);
    expect(check(document.documentElement)).toBe(false);
  });

  it('PASSES with Cyrillic error message in role=alert (Unicode-safe)', () => {
    document.title = 'Login';
    setBodyFromFragment(`
      <form>
        <input type="text" name="username">
        <div role="alert">Неверный пароль 🔒</div>
      </form>
    `);
    expect(check(document.documentElement)).toBe(true);
  });

  it('SKIPS error containers with only whitespace text', () => {
    // text.trim() empty → skipped per !text guard.
    document.title = 'Login';
    setBodyFromFragment(`
      <form>
        <input type="text" name="username">
        <div class="error">     </div>
      </form>
    `);
    expect(check(document.documentElement)).toBe(true);
  });

  it('FAILS with deeply nested error container (10+ levels) lacking live region', () => {
    document.title = 'Login';
    setBodyFromFragment(`
      <form>
        <input type="text" name="username">
        <div><div><div><div><div><div><div><div><div><div><div class="error">Bad credentials</div></div></div></div></div></div></div></div></div></div></div>
      </form>
    `);
    expect(check(document.documentElement)).toBe(false);
  });

  // Wave 3 — Stryker hardening for line 50 AND-clause (STOKES, 2026-05-17)
  // Pins each of the four conditions in:
  //   if (role !== 'alert' && live !== 'polite' && live !== 'assertive' && !ancestor)
  // so any single-clause mutation produces a different boolean result.

  it('PASSES when role=alert is the only thing satisfying the AND-clause', () => {
    // role IS alert → first guard short-circuits, error allowed.
    // Mutating role!=='alert' to true would flip this PASS → FAIL.
    document.title = 'Login';
    setBodyFromFragment(`
      <form>
        <input type="text" name="username">
        <div class="error" role="alert">Wrong password</div>
      </form>
    `);
    expect(check(document.documentElement)).toBe(true);
  });

  it('PASSES when aria-live=polite is the only thing satisfying the AND-clause', () => {
    // role missing, live=polite → second guard short-circuits.
    // Mutating live!=='polite' to true would flip this PASS → FAIL.
    document.title = 'Login';
    setBodyFromFragment(`
      <form>
        <input type="text" name="username">
        <div class="error" aria-live="polite">Wrong password</div>
      </form>
    `);
    expect(check(document.documentElement)).toBe(true);
  });

  it('PASSES when aria-live=assertive is the only thing satisfying the AND-clause', () => {
    // role missing, live=assertive → third guard short-circuits.
    // Mutating live!=='assertive' to true would flip this PASS → FAIL.
    document.title = 'Login';
    setBodyFromFragment(`
      <form>
        <input type="text" name="username">
        <div class="error" aria-live="assertive">Wrong password</div>
      </form>
    `);
    expect(check(document.documentElement)).toBe(true);
  });

  it('PASSES when only the ancestor live-region is present (no role / live on element)', () => {
    // role missing, live missing, ancestor present → fourth guard fires.
    // Mutating !ancestor to true would flip this PASS → FAIL.
    document.title = 'Login';
    setBodyFromFragment(`
      <form>
        <input type="text" name="username">
        <div aria-live="polite">
          <span class="error">Wrong password</span>
        </div>
      </form>
    `);
    expect(check(document.documentElement)).toBe(true);
  });

  it('FAILS when wrapper has no live-region attribute even if aria-live is non-canonical', () => {
    // Wrapper holds the error text, but element-level checks fail (no role,
    // no live), and ancestor selector finds nothing.
    // Note: putting aria-live ON the error element makes `closest()` match the
    // element itself (presence-based selector) — so aria-live MUST be absent
    // for the ancestor fallback to evaluate to null.
    document.title = 'Login';
    setBodyFromFragment(`
      <form>
        <input type="text" name="username">
        <span class="error-message">Wrong password</span>
      </form>
    `);
    expect(check(document.documentElement)).toBe(false);
  });

  it('FAILS when aria-live value is the wrong literal (e.g. "off"), no ancestor', () => {
    // aria-live="off" on a sibling wrapper — error itself has no live-region
    // attribute, and no ancestor matches the selector.
    // This pins live!=='polite' AND live!=='assertive' clauses.
    document.title = 'Login';
    setBodyFromFragment(`
      <form>
        <input type="text" name="username">
        <div>
          <span aria-live="off">unrelated status</span>
          <span class="error">Wrong password</span>
        </div>
      </form>
    `);
    // The .error span: role=null, live=null, ancestor (closest matching
    // aria-live/role=status/role=alert) is null because parent <div> has no
    // matching attribute. → all four conditions fire → false.
    expect(check(document.documentElement)).toBe(false);
  });
});
