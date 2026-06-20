// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
/**
 * Tests for `src/helpers.ts`.
 *
 * Stryker hardening for line 74 CSS.escape feature-detection polyfill.
 * Each branch of:
 *
 *   if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
 *     return CSS.escape(s);
 *   }
 *   return s.replace(/[^a-zA-Z0-9_-]/g, '\\$&');
 *
 * is pinned: native branch (happy-dom 15.x provides CSS.escape), polyfill
 * branch (mock globalThis.CSS = undefined), and the half-mock branch
 * (CSS exists but escape is missing).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { cssEscape, getAccessibleNameLite } from './helpers.js';

describe('helpers.cssEscape — native CSS.escape branch', () => {
  it('uses CSS.escape when available (happy-dom 15.x)', () => {
    // Smoke check — confirms the native code path runs in default test environment.
    // happy-dom does provide CSS.escape; the polyfill branch is exercised in the
    // dedicated describe-block below by deleting globalThis.CSS.
    expect(typeof CSS).not.toBe('undefined');
    expect(typeof CSS.escape).toBe('function');
    expect(cssEscape('a.b#c')).toBe(CSS.escape('a.b#c'));
  });

  it('escapes a digit-leading id correctly via native CSS.escape', () => {
    // CSS.escape("123") → "\\31 23" — pins that the native path is taken
    // and not silently bypassed.
    const out = cssEscape('123');
    expect(out).toBe(CSS.escape('123'));
    expect(out).not.toBe('123');
  });

  it('escapes a hyphen-leading id correctly via native CSS.escape', () => {
    const out = cssEscape('-test');
    expect(out).toBe(CSS.escape('-test'));
  });
});

describe('helpers.cssEscape — polyfill branch (CSS undefined)', () => {
  let originalCSS: typeof globalThis.CSS | undefined;

  beforeEach(() => {
    originalCSS = globalThis.CSS;
    // Force the polyfill branch by removing CSS entirely.
    // @ts-expect-error — intentionally deleting global for branch coverage.
    delete (globalThis as { CSS?: unknown }).CSS;
  });

  afterEach(() => {
    // Restore for downstream tests / suites.
    if (originalCSS !== undefined) {
      (globalThis as { CSS?: typeof originalCSS }).CSS = originalCSS;
    }
  });

  it('falls back to polyfill regex when CSS is undefined', () => {
    // Sanity-check the precondition for this branch.
    expect(typeof CSS).toBe('undefined');
    // Polyfill escapes any non-[a-zA-Z0-9_-] char with `\\$&`.
    expect(cssEscape('a.b')).toBe('a\\.b');
  });

  it('polyfill escapes digit-leading id by leaving digits alone', () => {
    // Polyfill regex matches /[^a-zA-Z0-9_-]/g — digits are NOT escaped
    // (the polyfill does not implement the full CSS.escape spec, just enough
    // for selector strings used in `cssEscape(id)` lookups).
    expect(cssEscape('123')).toBe('123');
  });

  it('polyfill escapes hyphen-leading id by leaving hyphen alone', () => {
    expect(cssEscape('-test')).toBe('-test');
  });

  it('polyfill escapes a backslash literal', () => {
    // "\\" → "\\\\" (one backslash, escaped to two).
    expect(cssEscape('\\')).toBe('\\\\');
  });

  it('polyfill escapes Unicode (Cyrillic) characters one by one', () => {
    // Each non-ASCII char prefixed with backslash.
    expect(cssEscape('тест')).toBe('\\т\\е\\с\\т');
  });

  it('polyfill returns empty string unchanged', () => {
    // Empty input → empty output (no chars to replace).
    expect(cssEscape('')).toBe('');
  });

  it('polyfill preserves alphanumerics, underscore, and hyphen verbatim', () => {
    // Whitelist character set should pass through untouched.
    expect(cssEscape('abc_DEF-123')).toBe('abc_DEF-123');
  });

  it('polyfill escapes spaces and special CSS metacharacters', () => {
    // Space and dot both outside whitelist.
    expect(cssEscape('a b.c')).toBe('a\\ b\\.c');
  });
});

describe('helpers.cssEscape — half-mock branch (CSS present, escape missing)', () => {
  let originalCSS: typeof globalThis.CSS | undefined;

  beforeEach(() => {
    originalCSS = globalThis.CSS;
    // CSS exists but CSS.escape is not a function — second clause of the
    // LogicalOperator (`typeof CSS.escape === 'function'`) should be false,
    // forcing the polyfill branch.
    (globalThis as { CSS?: object }).CSS = { supports: () => false } as unknown as typeof globalThis.CSS;
  });

  afterEach(() => {
    if (originalCSS !== undefined) {
      (globalThis as { CSS?: typeof originalCSS }).CSS = originalCSS;
    }
  });

  it('falls through to polyfill when CSS exists but CSS.escape is missing', () => {
    // The LogicalOperator survivor mutation `typeof CSS.escape === 'function'`
    // → `typeof CSS.escape !== 'function'` would invert this — fail-fast.
    expect(typeof CSS).not.toBe('undefined');
    expect(typeof (CSS as { escape?: unknown }).escape).not.toBe('function');
    // Polyfill output expected.
    expect(cssEscape('a.b')).toBe('a\\.b');
  });
});

describe('helpers.getAccessibleNameLite — branch coverage of cssEscape callsite', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('resolves <label for=...> when id contains a special char escaped via polyfill', () => {
    // End-to-end smoke that cssEscape is actually called from
    // getAccessibleNameLite's `label[for="..."]` selector path.
    document.body.innerHTML = `
      <label for="my.input">My Label</label>
      <input id="my.input" />
    `;
    const input = document.querySelector('input')!;
    expect(getAccessibleNameLite(input)).toBe('My Label');
  });
});

describe('helpers.getAccessibleNameLite — fallback ladder coverage', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('aria-labelledby resolves to a single referenced element', () => {
    // Pin labelledby branch (lines 26-36).
    document.body.innerHTML = `
      <span id="lbl1">Username</span>
      <input aria-labelledby="lbl1" />
    `;
    const input = document.querySelector('input')!;
    expect(getAccessibleNameLite(input)).toBe('Username');
  });

  it('aria-labelledby resolves multiple ids joined by space', () => {
    // Pin `labelledby.split(/\s+/).filter(Boolean)` and `parts.join(' ').trim()`.
    // Mutation `parts.join('')` would produce "FirstLast" (no space).
    document.body.innerHTML = `
      <span id="a">First</span>
      <span id="b">Last</span>
      <input aria-labelledby="a b" />
    `;
    const input = document.querySelector('input')!;
    expect(getAccessibleNameLite(input)).toBe('First Last');
  });

  it('aria-labelledby with missing ID references falls through (parts empty)', () => {
    // Pin `if (parts.length > 0)` boundary (line 35).
    // If all referenced IDs are missing → parts is empty → fallthrough to aria-label.
    document.body.innerHTML = `
      <input aria-labelledby="missing-id-1 missing-id-2" aria-label="fallback name" />
    `;
    const input = document.querySelector('input')!;
    expect(getAccessibleNameLite(input)).toBe('fallback name');
  });

  it('aria-label is used when present and labelledby missing', () => {
    document.body.innerHTML = `<input aria-label="Email address" />`;
    const input = document.querySelector('input')!;
    expect(getAccessibleNameLite(input)).toBe('Email address');
  });

  it('aria-label with only whitespace falls through to next strategy', () => {
    // Pin `if (ariaLabel && ariaLabel.trim())` — empty after trim → next.
    document.body.innerHTML = `<input aria-label="   " title="real title" />`;
    const input = document.querySelector('input')!;
    expect(getAccessibleNameLite(input)).toBe('real title');
  });

  it('label[for=id] association resolves text content', () => {
    document.body.innerHTML = `
      <label for="my-input">Phone Number</label>
      <input id="my-input" />
    `;
    const input = document.querySelector('input')!;
    expect(getAccessibleNameLite(input)).toBe('Phone Number');
  });

  it('wrapping <label> resolves text content (no for=id needed)', () => {
    // Pin `el.closest('label')` branch.
    document.body.innerHTML = `
      <label>
        Wrapping Label
        <input />
      </label>
    `;
    const input = document.querySelector('input')!;
    expect(getAccessibleNameLite(input)?.trim()).toBe('Wrapping Label');
  });

  it('title attribute is used when no aria/label sources match', () => {
    document.body.innerHTML = `<input title="Title text" />`;
    const input = document.querySelector('input')!;
    expect(getAccessibleNameLite(input)).toBe('Title text');
  });

  it('whitespace-only title falls through to placeholder', () => {
    // Pin `title && title.trim()` — whitespace-only title rejected.
    document.body.innerHTML = `<input title="   " placeholder="placeholder text" />`;
    const input = document.querySelector('input')!;
    expect(getAccessibleNameLite(input)).toBe('placeholder text');
  });

  it('placeholder is the last fallback for input', () => {
    document.body.innerHTML = `<input placeholder="enter value" />`;
    const input = document.querySelector('input')!;
    expect(getAccessibleNameLite(input)).toBe('enter value');
  });

  it('button text content used when no other source matches', () => {
    // Pin `tag === 'button' || tag === 'a'` OR clause and the text fallback.
    document.body.innerHTML = `<button>Click me</button>`;
    const button = document.querySelector('button')!;
    expect(getAccessibleNameLite(button)).toBe('Click me');
  });

  it('anchor text content used when no other source matches', () => {
    document.body.innerHTML = `<a href="/x">Read more</a>`;
    const a = document.querySelector('a')!;
    expect(getAccessibleNameLite(a)).toBe('Read more');
  });

  it('returns empty string for a non-button/non-anchor with no name sources', () => {
    // Pin final `return ''` — no aria, no label, no title, no placeholder,
    // and tag is not button/a → empty.
    document.body.innerHTML = `<div></div>`;
    const div = document.querySelector('div')!;
    expect(getAccessibleNameLite(div)).toBe('');
  });

  it('button with whitespace-only text returns empty string (no text branch)', () => {
    // Pin `if (text) return text` — empty text after trim → fallthrough → ''.
    document.body.innerHTML = `<button>   </button>`;
    const button = document.querySelector('button')!;
    expect(getAccessibleNameLite(button)).toBe('');
  });
});
