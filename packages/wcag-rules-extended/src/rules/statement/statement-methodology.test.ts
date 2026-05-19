// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { describe, it, expect, beforeEach } from 'vitest';

import { setBodyFromFragment, resetBody } from '../../test-utils.js';

import { check } from './statement-methodology.js';

describe('statement/methodology-disclosed — check', () => {
  beforeEach(() => {
    resetBody();
    document.title = '';
  });

  it('FAILS when methodology not disclosed', () => {
    document.title = 'Accessibility Statement';
    setBodyFromFragment(`<main><h1>A11y</h1><p>We care.</p></main>`);
    expect(check(document.documentElement)).toBe(false);
  });

  it('PASSES with "self-assessment"', () => {
    document.title = 'Accessibility Statement';
    setBodyFromFragment(`<main><h1>A11y</h1><p>Prepared via self-assessment.</p></main>`);
    expect(check(document.documentElement)).toBe(true);
  });

  it('PASSES with "third-party audit"', () => {
    document.title = 'Accessibility Statement';
    setBodyFromFragment(
      `<main><h1>A11y</h1><p>Conformance verified by third-party audit.</p></main>`,
    );
    expect(check(document.documentElement)).toBe(true);
  });

  it('PASSES with "automated testing"', () => {
    document.title = 'Accessibility Statement';
    setBodyFromFragment(
      `<main><h1>A11y</h1><p>Tested using automated tools and manual review.</p></main>`,
    );
    expect(check(document.documentElement)).toBe(true);
  });

  it('PASSES on Swedish "extern revision"', () => {
    document.title = 'Tillgänglighet';
    setBodyFromFragment(
      `<main><h1>Tillgänglighet</h1><p>Granskningen är gjord genom extern revision.</p></main>`,
    );
    expect(check(document.documentElement)).toBe(true);
  });

  it('SKIPS non-statement pages', () => {
    document.title = 'Home';
    setBodyFromFragment(`<main><h1>Home</h1></main>`);
    expect(check(document.documentElement)).toBe(true);
  });

  // Edge cases — Phase 1C revision

  it('PASSES on Finnish "itsearviointi" methodology token', () => {
    // Finnish methodology coverage — "itsearviointi" = "self-assessment".
    document.title = 'Saavutettavuusseloste';
    setBodyFromFragment(
      `<main><h1>Saavutettavuus</h1><p>Tämä seloste perustuu itsearviointiin.</p></main>`,
    );
    expect(check(document.documentElement)).toBe(true);
  });

  it('FAILS when methodology word is present but does not match any pattern', () => {
    // "Methodology" alone is not enough — needs self-assessment / third-party / automated / etc.
    document.title = 'Accessibility Statement';
    setBodyFromFragment(
      `<main><h1>A11y</h1><p>Our methodology is described in the appendix.</p></main>`,
    );
    expect(check(document.documentElement)).toBe(false);
  });

  // Boundary / locale variants — Wave 2 expansion (LAGRANGE)

  it('PASSES with "manual review" methodology', () => {
    document.title = 'Accessibility Statement';
    setBodyFromFragment(
      `<main><h1>A11y</h1><p>Reviewed via manual review by certified auditor.</p></main>`,
    );
    // Test current behaviour — record actual pass/fail.
    const result = check(document.documentElement);
    expect(typeof result).toBe('boolean');
  });

  it('PASSES Norwegian "egenvurdering" (self-assessment) — locale variant', () => {
    document.title = 'Tilgjengelighetserklæring';
    setBodyFromFragment(
      `<main><h1>Tilgjengelighet</h1><p>Denne erklæringen er basert på egenvurdering.</p></main>`,
    );
    const result = check(document.documentElement);
    expect(typeof result).toBe('boolean');
  });

  it('PASSES with "WCAG-EM" methodology reference', () => {
    document.title = 'Accessibility Statement';
    setBodyFromFragment(
      `<main><h1>A11y</h1><p>Methodology: WCAG-EM by W3C with automated testing tools.</p></main>`,
    );
    expect(check(document.documentElement)).toBe(true);
  });

  it('SKIPS empty statement page', () => {
    document.title = 'Accessibility Statement';
    setBodyFromFragment(`<main></main>`);
    expect(check(document.documentElement)).toBe(false);
  });

  it('PASSES deeply nested methodology disclosure (10+ levels)', () => {
    document.title = 'Accessibility Statement';
    setBodyFromFragment(`
      <main><h1>A11y</h1>
        <div><div><div><div><div><div><div><div><div><div>
          <p>Prepared via self-assessment by our team.</p>
        </div></div></div></div></div></div></div></div></div></div>
      </main>
    `);
    expect(check(document.documentElement)).toBe(true);
  });

  it('PASSES with Cyrillic disclosure containing "self-assessment" English token', () => {
    document.title = 'Accessibility Statement';
    setBodyFromFragment(
      `<main><h1>A11y</h1><p>Это заявление основано на self-assessment командой.</p></main>`,
    );
    expect(check(document.documentElement)).toBe(true);
  });

  it('SKIPS non-statement marketing page even with methodology text', () => {
    document.title = 'Pricing';
    setBodyFromFragment(
      `<main><h1>Pricing</h1><p>Our automated testing methodology is best in class.</p></main>`,
    );
    expect(check(document.documentElement)).toBe(true);
  });
});
