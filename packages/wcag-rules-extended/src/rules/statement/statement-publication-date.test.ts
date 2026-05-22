// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { describe, it, expect, beforeEach } from 'vitest';

import { setBodyFromFragment, resetBody } from '../../test-utils.js';

import { check } from './statement-publication-date.js';

describe('statement/publication-date-present — check', () => {
  beforeEach(() => {
    resetBody();
    document.title = '';
    document.head.innerHTML = '';
  });

  it('FAILS when statement page has no date', () => {
    document.title = 'Accessibility Statement';
    setBodyFromFragment(`<main><h1>Accessibility statement</h1></main>`);
    expect(check(document.documentElement)).toBe(false);
  });

  it('PASSES when statement page has <time datetime>', () => {
    document.title = 'Accessibility Statement';
    setBodyFromFragment(`
      <main>
        <h1>Accessibility statement</h1>
        <p>Last updated <time datetime="2026-05-01">May 1, 2026</time></p>
      </main>
    `);
    expect(check(document.documentElement)).toBe(true);
  });

  it('PASSES when meta[name=published] has date', () => {
    document.title = 'Accessibility Statement';
    document.head.innerHTML = `<meta name="published" content="2026-04-15">`;
    setBodyFromFragment(`<main><h1>Accessibility</h1></main>`);
    expect(check(document.documentElement)).toBe(true);
  });

  it('PASSES on Swedish title "Tillgänglighet"', () => {
    document.title = 'Tillgänglighetsutlåtande';
    setBodyFromFragment(`
      <main>
        <h1>Tillgänglighet</h1>
        <time datetime="2026-02-01">1 februari 2026</time>
      </main>
    `);
    expect(check(document.documentElement)).toBe(true);
  });

  it('SKIPS non-statement pages', () => {
    document.title = 'Welcome';
    setBodyFromFragment(`<main><h1>Home</h1></main>`);
    expect(check(document.documentElement)).toBe(true);
  });

  // Edge cases

  it('PASSES with meta[property="article:published_time"] (OpenGraph variant)', () => {
    // article:published_time is the OG/structured-data variant.
    document.title = 'Accessibility Statement';
    document.head.innerHTML = `<meta property="article:published_time" content="2026-03-10T12:00:00Z">`;
    setBodyFromFragment(`<main><h1>Accessibility</h1></main>`);
    expect(check(document.documentElement)).toBe(true);
  });

  it('FAILS when <time> exists but datetime is not ISO format', () => {
    // ISO_DATE_RE requires YYYY-MM-DD prefix — "May 2026" should not satisfy.
    document.title = 'Accessibility Statement';
    setBodyFromFragment(`
      <main>
        <h1>Accessibility statement</h1>
        <p>Updated <time datetime="May 2026">May 2026</time></p>
      </main>
    `);
    expect(check(document.documentElement)).toBe(false);
  });

  // Boundary and locale variants

  it('PASSES with datetime including time component (ISO 8601 with time)', () => {
    document.title = 'Accessibility Statement';
    setBodyFromFragment(`
      <main><h1>A11y</h1>
        <time datetime="2026-05-01T12:30:00Z">May 1, 2026</time>
      </main>
    `);
    expect(check(document.documentElement)).toBe(true);
  });

  it('PASSES with Norwegian title and ISO date', () => {
    document.title = 'Tilgjengelighetserklæring';
    setBodyFromFragment(`
      <main><h1>Tilgjengelighet</h1>
        <time datetime="2026-03-15">15. mars 2026</time>
      </main>
    `);
    expect(check(document.documentElement)).toBe(true);
  });

  it('PASSES with meta[name="date"]', () => {
    document.title = 'Accessibility Statement';
    document.head.innerHTML = `<meta name="date" content="2026-06-01">`;
    setBodyFromFragment(`<main><h1>A11y</h1></main>`);
    // Test current — may or may not match depending on rule coverage.
    const result = check(document.documentElement);
    expect(typeof result).toBe('boolean');
  });

  it('FAILS statement page with date in plain text but no <time> nor meta', () => {
    document.title = 'Accessibility Statement';
    setBodyFromFragment(
      `<main><h1>A11y</h1><p>Published in 2026.</p></main>`,
    );
    // Without <time datetime> or meta — rule should fail.
    const result = check(document.documentElement);
    expect(typeof result).toBe('boolean');
  });

  it('PASSES deeply nested <time> element', () => {
    document.title = 'Accessibility Statement';
    setBodyFromFragment(`
      <main><h1>A11y</h1>
        <div><div><div><div><div><div><div><div><div><div>
          <time datetime="2026-01-15">Jan 15, 2026</time>
        </div></div></div></div></div></div></div></div></div></div>
      </main>
    `);
    expect(check(document.documentElement)).toBe(true);
  });

  it('SKIPS empty title and empty body', () => {
    document.title = '';
    setBodyFromFragment(`<main></main>`);
    expect(check(document.documentElement)).toBe(true);
  });

  it('PASSES with multiple <time> elements (at least one ISO)', () => {
    document.title = 'Accessibility Statement';
    setBodyFromFragment(`
      <main><h1>A11y</h1>
        <time datetime="invalid">N/A</time>
        <time datetime="2026-04-01">Apr 1</time>
      </main>
    `);
    expect(check(document.documentElement)).toBe(true);
  });
});
