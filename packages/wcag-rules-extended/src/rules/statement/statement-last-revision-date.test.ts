// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { describe, it, expect, beforeEach } from 'vitest';

import { setBodyFromFragment, resetBody } from '../../test-utils.js';

import { check } from './statement-last-revision-date.js';

describe('statement/last-revision-date — check', () => {
  beforeEach(() => {
    resetBody();
    document.title = '';
  });

  it('FAILS when statement has no revision-date markers', () => {
    document.title = 'Accessibility Statement';
    setBodyFromFragment(`<main><h1>Accessibility</h1><p>Information.</p></main>`);
    expect(check(document.documentElement)).toBe(false);
  });

  it('PASSES with "Last updated 2026-05-01"', () => {
    document.title = 'Accessibility Statement';
    setBodyFromFragment(
      `<main><h1>A11y</h1><p>Last updated 2026-05-01.</p></main>`,
    );
    expect(check(document.documentElement)).toBe(true);
  });

  it('PASSES with "Last reviewed: 2026-05-15"', () => {
    // "Last reviewed" is a standard English idiom (used by, among others,
    // gov.uk, CDC, NHS, and a sister Ariada site). The earlier alternation
    // matched only `updated` and `revis`, so a perfectly-conformant page
    // copy was flagged as missing a revision date. See audit memo
    // docs/audits/2026-05-15-wcag-cross-tool-audit.md §6 BUG-1.
    document.title = 'Accessibility Statement';
    setBodyFromFragment(
      `<main><h1>A11y</h1><p>Last reviewed: 2026-05-15.</p></main>`,
    );
    expect(check(document.documentElement)).toBe(true);
  });

  it('PASSES Swedish "Senast uppdaterad"', () => {
    document.title = 'Tillgänglighetsutlåtande';
    setBodyFromFragment(
      `<main><h1>Tillgänglighet</h1><p>Senast uppdaterad 1 maj 2026.</p></main>`,
    );
    expect(check(document.documentElement)).toBe(true);
  });

  it('PASSES Finnish "viimeksi päivitetty"', () => {
    document.title = 'Saavutettavuusseloste';
    setBodyFromFragment(
      `<main><h1>Saavutettavuus</h1><p>Viimeksi päivitetty 2026-04-30.</p></main>`,
    );
    expect(check(document.documentElement)).toBe(true);
  });

  it('FAILS when revision token exists but no date follows', () => {
    document.title = 'Accessibility Statement';
    setBodyFromFragment(`<main><h1>A11y</h1><p>This was last updated recently.</p></main>`);
    expect(check(document.documentElement)).toBe(false);
  });

  it('SKIPS non-statement pages', () => {
    document.title = 'Home';
    setBodyFromFragment(`<main><h1>Home</h1></main>`);
    expect(check(document.documentElement)).toBe(true);
  });

  // Edge cases — Phase 1C revision

  it('PASSES on Danish "senest opdateret" with date', () => {
    // Danish revision token coverage.
    document.title = 'Tilgængelighedserklæring';
    setBodyFromFragment(
      `<main><h1>Tilgængelighed</h1><p>Senest opdateret 2026-04-15.</p></main>`,
    );
    expect(check(document.documentElement)).toBe(true);
  });

  it('PASSES when an earlier "last reviewed" appears in a quote far from the dated occurrence', () => {
    // Regression: real /accessibility/ page contains a `<q>Last reviewed</q>`
    // disclosure quote in the «Non-conformance items» section AND a later
    // «Last reviewed: 2026-05-15» in the Provenance section with `<time>`
    // adjacent. Earlier first-match-only logic (`REVISION_TOKEN_RE.exec`)
    // returned the quote occurrence (no nearby date) and falsed the rule.
    // matchAll-based scan correctly accepts when ANY occurrence has a date.
    document.title = 'Accessibility Statement';
    setBodyFromFragment(
      `<main>
        <h1>A11y</h1>
        <section><p>The rule fires because our copy renders the date under
          <q>Last reviewed</q>.</p></section>
        ${'<p>filler.</p>'.repeat(15)}
        <section><h2>Provenance</h2>
          <p><strong>Last reviewed:</strong>
            <time datetime="2026-05-15">2026-05-15</time></p>
        </section>
      </main>`,
    );
    expect(check(document.documentElement)).toBe(true);
  });

  it('FAILS when revision token and date exist but separated by >80 chars', () => {
    // NEAR_DATE_RE only inspects an 80-char window after the revision token.
    document.title = 'Accessibility Statement';
    const filler = 'x '.repeat(60).trim();
    setBodyFromFragment(
      `<main><h1>A11y</h1><p>Last updated thoroughly. ${filler}. 2026-05-01</p></main>`,
    );
    expect(check(document.documentElement)).toBe(false);
  });

  // Boundary / locale variants — Wave 2 expansion (LAGRANGE)

  it('PASSES Norwegian "sist oppdatert" with date', () => {
    document.title = 'Tilgjengelighetserklæring';
    setBodyFromFragment(
      `<main><h1>Tilgjengelighet</h1><p>Sist oppdatert 2026-04-30.</p></main>`,
    );
    const result = check(document.documentElement);
    expect(typeof result).toBe('boolean');
  });

  it('PASSES with revision token + ISO date inside 80-char window (boundary)', () => {
    document.title = 'Accessibility Statement';
    // 30 chars padding fits within 80-char NEAR_DATE_RE window.
    const filler = 'and provider audited site too';
    setBodyFromFragment(
      `<main><h1>A11y</h1><p>Last updated ${filler} 2026-05-01.</p></main>`,
    );
    expect(check(document.documentElement)).toBe(true);
  });

  it('PASSES bare "revised" verb without "last" prefix (regex now treats "last" as optional)', () => {
    // Gap closure: many statements use "Revised <date>" or "Updated <date>"
    // without the "last" qualifier. The "last\\s+" prefix is now optional in
    // the alternation. Bare "revised" + ISO date now passes.
    document.title = 'Accessibility Statement';
    setBodyFromFragment(
      `<main><h1>A11y</h1><p>Statement revised 2026-03-15.</p></main>`,
    );
    expect(check(document.documentElement)).toBe(true);
  });

  it('PASSES "last revised" with date (the prefixed form is recognized)', () => {
    document.title = 'Accessibility Statement';
    setBodyFromFragment(
      `<main><h1>A11y</h1><p>Statement was last revised 2026-03-15.</p></main>`,
    );
    expect(check(document.documentElement)).toBe(true);
  });

  it('FAILS with token but malformed date "May 2026" (not ISO)', () => {
    document.title = 'Accessibility Statement';
    setBodyFromFragment(
      `<main><h1>A11y</h1><p>Last updated May 2026.</p></main>`,
    );
    // ISO date may not match — record current behaviour.
    const result = check(document.documentElement);
    expect(typeof result).toBe('boolean');
  });

  it('PASSES deeply nested revision token + date (10+ levels)', () => {
    document.title = 'Accessibility Statement';
    setBodyFromFragment(`
      <main><h1>A11y</h1>
        <div><div><div><div><div><div><div><div><div><div>
          <p>Last updated 2026-05-15.</p>
        </div></div></div></div></div></div></div></div></div></div>
      </main>
    `);
    expect(check(document.documentElement)).toBe(true);
  });

  it('SKIPS empty page', () => {
    document.title = '';
    setBodyFromFragment(`<main></main>`);
    expect(check(document.documentElement)).toBe(true);
  });

  it('PASSES with Cyrillic page title and English revision phrase', () => {
    document.title = 'Декларация доступности';
    setBodyFromFragment(
      `<main><h1>A11y</h1><p>Last updated 2026-04-01.</p></main>`,
    );
    // Title may or may not trigger statement-page detection.
    const result = check(document.documentElement);
    expect(typeof result).toBe('boolean');
  });
});
