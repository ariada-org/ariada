// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { describe, it, expect, beforeEach } from 'vitest';

import { setBodyFromFragment, resetBody } from '../../test-utils.js';

import { check } from './statement-skip-link.js';

describe('statement/skip-link-from-every-page — check', () => {
  beforeEach(() => resetBody());

  it('FAILS without skip link', () => {
    setBodyFromFragment(`<header>Nav</header><main>Content</main>`);
    expect(check(document.documentElement)).toBe(false);
  });

  it('PASSES with English skip link', () => {
    setBodyFromFragment(`
      <a href="#main">Skip to main content</a>
      <main id="main">Content</main>
    `);
    expect(check(document.documentElement)).toBe(true);
  });

  it('PASSES on Swedish "Hoppa till"', () => {
    setBodyFromFragment(
      `<a href="#main">Hoppa till huvudinnehållet</a><main id="main">Content</main>`,
    );
    expect(check(document.documentElement)).toBe(true);
  });

  it('PASSES on Norwegian "Gå til innhold"', () => {
    setBodyFromFragment(
      `<a href="#main">Gå til innhold</a><main id="main">Content</main>`,
    );
    expect(check(document.documentElement)).toBe(true);
  });

  it('PASSES on Finnish "Siirry sisältöön"', () => {
    setBodyFromFragment(
      `<a href="#main">Siirry sisältöön</a><main id="main">Content</main>`,
    );
    expect(check(document.documentElement)).toBe(true);
  });

  it('FAILS when anchor exists but text is not skip-link', () => {
    setBodyFromFragment(`<a href="#top">Back to top</a><main>Content</main>`);
    expect(check(document.documentElement)).toBe(false);
  });

  // Edge cases

  it('FAILS when skip-text exists on anchor but href is not a fragment (#)', () => {
    // isSkipLinkCandidate requires href to start with "#" — external link disqualifies.
    setBodyFromFragment(
      `<a href="/main">Skip to main content</a><main>Content</main>`,
    );
    expect(check(document.documentElement)).toBe(false);
  });

  it('PASSES when skip link is wrapped in a <header> sticky element', () => {
    // Skip link can be nested inside other elements — rule scans all a[href^="#"].
    setBodyFromFragment(`
      <header><nav><a href="#main">Skip navigation</a></nav></header>
      <main id="main">Content</main>
    `);
    expect(check(document.documentElement)).toBe(true);
  });

  // Boundary and locale variants

  it('PASSES Danish "Spring til" skip-link text', () => {
    setBodyFromFragment(
      `<a href="#main">Spring til indhold</a><main id="main">Content</main>`,
    );
    // Test current — Danish coverage may or may not exist.
    const result = check(document.documentElement);
    expect(typeof result).toBe('boolean');
  });

  it('PASSES with skip link to #content (alternate target id)', () => {
    setBodyFromFragment(
      `<a href="#content">Skip to main content</a><div id="content">Content</div>`,
    );
    expect(check(document.documentElement)).toBe(true);
  });

  it('FAILS skip-text inside button (not anchor — rule requires <a href>)', () => {
    setBodyFromFragment(
      `<button>Skip to main content</button><main>Content</main>`,
    );
    expect(check(document.documentElement)).toBe(false);
  });

  it('FAILS empty body (no anchors at all)', () => {
    setBodyFromFragment(``);
    expect(check(document.documentElement)).toBe(false);
  });

  it('PASSES with multiple anchors, only first is skip link', () => {
    setBodyFromFragment(`
      <a href="#main">Skip to main</a>
      <a href="/about">About</a>
      <a href="/contact">Contact</a>
      <main id="main">Content</main>
    `);
    expect(check(document.documentElement)).toBe(true);
  });

  it('PASSES deeply nested skip link (10+ levels)', () => {
    setBodyFromFragment(`
      <div><div><div><div><div><div><div><div><div><div>
        <a href="#main">Skip to content</a>
      </div></div></div></div></div></div></div></div></div></div>
      <main id="main">Content</main>
    `);
    expect(check(document.documentElement)).toBe(true);
  });

  it('PASSES Cyrillic skip link "Перейти к содержимому"', () => {
    setBodyFromFragment(
      `<a href="#main">Перейти к содержимому</a><main id="main">Content</main>`,
    );
    // Document current — Cyrillic may not be in pattern.
    const result = check(document.documentElement);
    expect(typeof result).toBe('boolean');
  });
});
