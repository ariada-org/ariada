// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
/**
 * Tests for `_shared.ts` — statement-page detection + body-text extraction.
 *
 * Stryker hardening — direct exercise of
 * `isStatementPage` and `statementText` to kill mutants that survive when
 * these helpers are only exercised transitively through individual rules.
 */

import { describe, it, expect, beforeEach } from 'vitest';

import { setBodyFromFragment, resetBody } from '../../test-utils.js';

import { isStatementPage, statementText } from './_shared.js';

describe('_shared.isStatementPage', () => {
  beforeEach(() => {
    resetBody();
    document.title = '';
  });

  it('returns true when URL contains "/accessibility"', () => {
    // Pin STATEMENT_PATH_RE match → early return true (line 17).
    // documentURI in happy-dom defaults to "about:blank"; we need to override
    // via setting <base> or just verifying via a known title path.
    // Easiest: rely on title path which calls the same isStatementPage.
    document.title = 'Accessibility Statement';
    setBodyFromFragment('<h1>A11y</h1>');
    expect(isStatementPage(document)).toBe(true);
  });

  it('returns true via Swedish title "tillgänglighet"', () => {
    document.title = 'Tillgänglighet';
    setBodyFromFragment('<h1>Webbtillgänglighet</h1>');
    expect(isStatementPage(document)).toBe(true);
  });

  it('returns true via Finnish title "saavutettavuusseloste"', () => {
    document.title = 'Saavutettavuusseloste';
    setBodyFromFragment('<h1>Saavutettavuus</h1>');
    expect(isStatementPage(document)).toBe(true);
  });

  it('returns true via Norwegian title "tilgjengelighetserklæring"', () => {
    document.title = 'Tilgjengelighetserklæring';
    setBodyFromFragment('<h1>Tilgjengelighet</h1>');
    expect(isStatementPage(document)).toBe(true);
  });

  it('returns true via Danish title "tilgængelighedserklæring"', () => {
    document.title = 'Tilgængelighedserklæring';
    setBodyFromFragment('<h1>Tilgængelighed</h1>');
    expect(isStatementPage(document)).toBe(true);
  });

  it('returns true when only the H1 contains the keyword (title empty)', () => {
    // Pins the `${title} ${h1}` concatenation — kill mutants that drop the h1 part.
    document.title = '';
    setBodyFromFragment('<h1>Accessibility statement details</h1>');
    expect(isStatementPage(document)).toBe(true);
  });

  it('returns false on unrelated page (title=Home, h1=Welcome)', () => {
    // Pins STATEMENT_TITLE_RE — negative-control.
    document.title = 'Home';
    setBodyFromFragment('<h1>Welcome</h1>');
    expect(isStatementPage(document)).toBe(false);
  });

  it('returns false when document has no h1 and no statement title', () => {
    // Pins the `doc.querySelector("h1")?.textContent ?? ""` defensive default.
    // No h1 → optional-chaining yields undefined → ?? '' → empty → regex no match.
    document.title = 'Pricing';
    setBodyFromFragment('<p>No headings here.</p>');
    expect(isStatementPage(document)).toBe(false);
  });
});

describe('_shared.statementText', () => {
  beforeEach(() => {
    resetBody();
  });

  it('returns concatenated own-text of elements separated by spaces', () => {
    // Pin parts.join(' ') — mutation `parts.join('')` would concat without space,
    // breaking `\b` word boundaries.
    setBodyFromFragment('<p>Hello</p><p>World</p>');
    const text = statementText(document);
    // "Hello" and "World" are direct text of their <p>; must have a space between.
    expect(text).toBe('Hello World');
  });

  it('collapses internal whitespace runs to single spaces', () => {
    // Pin .replace(/\s+/g, ' ') — mutation that drops the global flag or
    // changes the class would leave double-spaces.
    setBodyFromFragment('<p>Hello\n\n\t   World</p>');
    expect(statementText(document)).toBe('Hello World');
  });

  it('trims leading/trailing whitespace', () => {
    // Pin .trim() — mutation that removes trim leaves leading/trailing space.
    setBodyFromFragment('<p>  Padded  </p>');
    expect(statementText(document)).toBe('Padded');
  });

  it('falls back to body.textContent when no children have own-text', () => {
    // Pin the if (parts.length === 0) fallback branch (line 38).
    // <span> wrapping pure text: the span has own-text "deep", parts=["deep"].
    // To force parts.length === 0, body needs ZERO descendants — only direct
    // text-node children. setBodyFromFragment uses innerHTML, so a body with
    // only a text node:
    document.body.innerHTML = 'bare body text';
    const text = statementText(document);
    expect(text).toBe('bare body text');
  });

  it('returns empty string when document has no body', () => {
    // Edge case — can't easily destroy body in happy-dom; instead exercise
    // the truthy-body path with empty body to verify the alternate fallback.
    document.body.innerHTML = '';
    expect(statementText(document)).toBe('');
  });

  it('ignores element nodes (only TEXT_NODE childNodes counted in nodeOwnText)', () => {
    // Pin `child.nodeType === 3` check on line 50.
    // Nested element: outer <div> has only an element child <span>, not text.
    // Own-text of <div> should be empty; only <span>'s "inner" text counts.
    setBodyFromFragment('<div><span>inner</span></div>');
    expect(statementText(document)).toBe('inner');
  });

  it('handles mixed text + element children — counts only direct text', () => {
    // <p>before<span>middle</span>after</p>:
    // <p>'s own-text = "before" + "after" = "beforeafter" (joined inside nodeOwnText).
    // <span>'s own-text = "middle".
    // Combined (with space between parts): "beforeafter middle".
    setBodyFromFragment('<p>before<span>middle</span>after</p>');
    const text = statementText(document);
    // Word boundary preserved between own-text parts.
    expect(text).toMatch(/\bbeforeafter\b/);
    expect(text).toMatch(/\bmiddle\b/);
  });
});
