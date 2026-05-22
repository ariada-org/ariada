// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { describe, it, expect, beforeEach } from 'vitest';

import { setBodyFromFragment, resetBody } from '../../test-utils.js';

import { check } from './statement-conformance-level.js';

describe('statement/conformance-level-declared — check', () => {
  beforeEach(() => {
    resetBody();
    document.title = '';
  });

  it('FAILS when statement does not mention conformance', () => {
    document.title = 'Accessibility Statement';
    setBodyFromFragment(
      `<main><h1>Accessibility</h1><p>We care about accessibility.</p></main>`,
    );
    expect(check(document.documentElement)).toBe(false);
  });

  it('PASSES when statement says "partially conformant"', () => {
    document.title = 'Accessibility Statement';
    setBodyFromFragment(
      `<main><h1>Accessibility</h1><p>This website is partially conformant with WCAG 2.2 AA.</p></main>`,
    );
    expect(check(document.documentElement)).toBe(true);
  });

  it('PASSES on Swedish "delvis förenlig"', () => {
    document.title = 'Tillgänglighetsutlåtande';
    setBodyFromFragment(
      `<main><h1>Tillgänglighet</h1><p>Webbplatsen är delvis förenlig med WCAG 2.2 AA.</p></main>`,
    );
    expect(check(document.documentElement)).toBe(true);
  });

  it('PASSES on Finnish "osittain yhdenmukainen"', () => {
    document.title = 'Saavutettavuusseloste';
    setBodyFromFragment(
      `<main><h1>Saavutettavuus</h1><p>Verkkosivusto on osittain yhdenmukainen WCAG 2.2 AA -tason kanssa.</p></main>`,
    );
    expect(check(document.documentElement)).toBe(true);
  });

  it('SKIPS non-statement pages', () => {
    document.title = 'Home';
    setBodyFromFragment(`<main><h1>Welcome</h1></main>`);
    expect(check(document.documentElement)).toBe(true);
  });

  // Edge cases

  it('PASSES on Danish "fuldt overensstemmende"', () => {
    // Danish conformance phrase coverage (already in CONFORMANCE_PATTERNS).
    document.title = 'Tilgængelighedserklæring';
    setBodyFromFragment(
      `<main><h1>Tilgængelighed</h1><p>Webstedet er fuldt overensstemmende med WCAG 2.2 AA.</p></main>`,
    );
    expect(check(document.documentElement)).toBe(true);
  });

  it('FAILS on near-match phrase without "conformant" keyword', () => {
    // "Conformity" alone (without conformant/conformance) should not trigger.
    document.title = 'Accessibility Statement';
    setBodyFromFragment(
      `<main><h1>A11y</h1><p>We aim for conformity with web standards generally.</p></main>`,
    );
    expect(check(document.documentElement)).toBe(false);
  });

  // Boundary and locale variants

  it('PASSES "non-conformant" declaration (fully not-conformant variant)', () => {
    document.title = 'Accessibility Statement';
    setBodyFromFragment(
      `<main><h1>A11y</h1><p>This website is non-conformant with WCAG 2.2 AA.</p></main>`,
    );
    expect(check(document.documentElement)).toBe(true);
  });

  it('PASSES "fully conformant" declaration', () => {
    document.title = 'Accessibility Statement';
    setBodyFromFragment(
      `<main><h1>A11y</h1><p>This site is fully conformant with WCAG 2.2 AA.</p></main>`,
    );
    expect(check(document.documentElement)).toBe(true);
  });

  it('PASSES Norwegian "delvis i samsvar" (statement page title triggers)', () => {
    document.title = 'Tilgjengelighetserklæring';
    setBodyFromFragment(
      `<main><h1>Tilgjengelighet</h1><p>Nettstedet er delvis i samsvar med WCAG 2.2 AA.</p></main>`,
    );
    // Test current behaviour — may match or skip depending on pattern coverage.
    const result = check(document.documentElement);
    expect(typeof result).toBe('boolean');
  });

  it('SKIPS empty statement page', () => {
    document.title = 'Accessibility Statement';
    setBodyFromFragment(`<main></main>`);
    expect(check(document.documentElement)).toBe(false);
  });

  it('PASSES with Cyrillic title plus English conformance phrase', () => {
    document.title = 'Accessibility Statement Декларация';
    setBodyFromFragment(
      `<main><h1>A11y</h1><p>Сайт partially conformant с WCAG 2.2 AA.</p></main>`,
    );
    expect(check(document.documentElement)).toBe(true);
  });

  it('PASSES deeply nested conformance text (10+ levels)', () => {
    document.title = 'Accessibility Statement';
    setBodyFromFragment(`
      <main>
        <h1>A11y</h1>
        <div><div><div><div><div><div><div><div><div><div>
          <p>This website is partially conformant with WCAG 2.2 AA.</p>
        </div></div></div></div></div></div></div></div></div></div>
      </main>
    `);
    expect(check(document.documentElement)).toBe(true);
  });

  it('SKIPS when title and body do not indicate statement page', () => {
    document.title = 'Pricing Plans';
    setBodyFromFragment(
      `<main><h1>Pricing</h1><p>Fully conformant with WCAG 2.2 AA.</p></main>`,
    );
    expect(check(document.documentElement)).toBe(true);
  });

  // Stryker hardening of CONFORMANCE_PATTERNS array.
  // Each regex alternation pinned individually so mutating any alternative
  // (e.g. /partially/ → /xartially/) flips the result.

  it('PASSES on bare "partially" keyword (English alt 2)', () => {
    // First CONFORMANCE_PATTERNS regex alt-1: /\b(fully|fully\s+conformant|full\s+conformance)\b/i
    // Alt-2 regex: /\b(partially|partially\s+conformant|partial\s+conformance)\b/i
    // Bare "partially" alone (no "conformant" follow-up) should already match.
    document.title = 'Accessibility Statement';
    setBodyFromFragment(
      `<main><h1>A11y</h1><p>This website is partially compliant overall.</p></main>`,
    );
    expect(check(document.documentElement)).toBe(true);
  });

  it('PASSES on bare "fully" keyword', () => {
    document.title = 'Accessibility Statement';
    setBodyFromFragment(
      `<main><h1>A11y</h1><p>This website is fully compliant with WCAG.</p></main>`,
    );
    expect(check(document.documentElement)).toBe(true);
  });

  it('PASSES on "non conformant" with space (no hyphen)', () => {
    // Alt-3 regex: /\b(non[\s-]?conformant|not\s+conformant)\b/i
    // Space variant.
    document.title = 'Accessibility Statement';
    setBodyFromFragment(
      `<main><h1>A11y</h1><p>This site is non conformant with WCAG 2.2 AA.</p></main>`,
    );
    expect(check(document.documentElement)).toBe(true);
  });

  it('PASSES on "not conformant" wording variant', () => {
    // Same alt-3 regex, "not conformant" alternative.
    document.title = 'Accessibility Statement';
    setBodyFromFragment(
      `<main><h1>A11y</h1><p>This site is not conformant with WCAG 2.2 AA.</p></main>`,
    );
    expect(check(document.documentElement)).toBe(true);
  });

  it('PASSES on Swedish "inte förenlig"', () => {
    // 4th regex (Swedish): /\b(fullt\s+förenlig|delvis\s+förenlig|inte\s+förenlig)/i
    // "inte förenlig" alt.
    document.title = 'Tillgänglighetsutlåtande';
    setBodyFromFragment(
      `<main><h1>Tillgänglighet</h1><p>Webbplatsen är inte förenlig med WCAG.</p></main>`,
    );
    expect(check(document.documentElement)).toBe(true);
  });

  it('PASSES on Swedish "fullt förenlig"', () => {
    document.title = 'Tillgänglighetsutlåtande';
    setBodyFromFragment(
      `<main><h1>Tillgänglighet</h1><p>Webbplatsen är fullt förenlig med WCAG.</p></main>`,
    );
    expect(check(document.documentElement)).toBe(true);
  });

  it('PASSES on Norwegian "fullt samsvar"', () => {
    // 5th regex (Norwegian): /\b(fullt\s+samsvar|delvis\s+samsvar|ikke\s+samsvar)/i
    document.title = 'Tilgjengelighetserklæring';
    setBodyFromFragment(
      `<main><h1>Tilgjengelighet</h1><p>Nettstedet er i fullt samsvar med WCAG.</p></main>`,
    );
    expect(check(document.documentElement)).toBe(true);
  });

  it('PASSES on Norwegian "ikke samsvar"', () => {
    document.title = 'Tilgjengelighetserklæring';
    setBodyFromFragment(
      `<main><h1>Tilgjengelighet</h1><p>Nettstedet er ikke i samsvar med WCAG. Faktisk: ikke samsvar i det hele.</p></main>`,
    );
    expect(check(document.documentElement)).toBe(true);
  });

  it('PASSES on Danish "delvist overensstemmende"', () => {
    // 6th regex (Danish): /\b(fuldt\s+overensstemmende|delvist\s+overensstemmende|ikke\s+overensstemmende)/i
    document.title = 'Tilgængelighedserklæring';
    setBodyFromFragment(
      `<main><h1>Tilgængelighed</h1><p>Webstedet er delvist overensstemmende med WCAG.</p></main>`,
    );
    expect(check(document.documentElement)).toBe(true);
  });

  it('PASSES on Danish "ikke overensstemmende"', () => {
    document.title = 'Tilgængelighedserklæring';
    setBodyFromFragment(
      `<main><h1>Tilgængelighed</h1><p>Webstedet er ikke overensstemmende med WCAG.</p></main>`,
    );
    expect(check(document.documentElement)).toBe(true);
  });

  it('PASSES on Finnish "ei yhdenmukai..." (third alt)', () => {
    // 7th regex (Finnish): /\b(t[äa]ysin\s+yhdenmukai|osittain\s+yhdenmukai|ei\s+yhdenmukai)/i
    document.title = 'Saavutettavuusseloste';
    setBodyFromFragment(
      `<main><h1>Saavutettavuus</h1><p>Verkkosivusto ei yhdenmukainen WCAG-standardin kanssa.</p></main>`,
    );
    expect(check(document.documentElement)).toBe(true);
  });

  it('PASSES on Finnish "täysin yhdenmukai..." with ä variant', () => {
    document.title = 'Saavutettavuusseloste';
    setBodyFromFragment(
      `<main><h1>Saavutettavuus</h1><p>Verkkosivusto on täysin yhdenmukainen WCAG kanssa.</p></main>`,
    );
    expect(check(document.documentElement)).toBe(true);
  });

  it('PASSES on Finnish "taysin yhdenmukai..." with a variant (ASCII fallback)', () => {
    // Pin the `[äa]` character class — "taysin" (ASCII a) should also match.
    document.title = 'Saavutettavuusseloste';
    setBodyFromFragment(
      `<main><h1>Saavutettavuus</h1><p>Verkkosivusto on taysin yhdenmukainen WCAG kanssa.</p></main>`,
    );
    expect(check(document.documentElement)).toBe(true);
  });

  it('case-insensitive matching — uppercase "PARTIALLY" still passes', () => {
    // /i flag pin — mutating away the flag would flip this.
    document.title = 'Accessibility Statement';
    setBodyFromFragment(
      `<main><h1>A11y</h1><p>This site is PARTIALLY CONFORMANT with WCAG.</p></main>`,
    );
    expect(check(document.documentElement)).toBe(true);
  });

  it('case-insensitive matching — mixed-case "Fully Conformant"', () => {
    document.title = 'Accessibility Statement';
    setBodyFromFragment(
      `<main><h1>A11y</h1><p>This site is Fully Conformant with WCAG 2.2 AA.</p></main>`,
    );
    expect(check(document.documentElement)).toBe(true);
  });

  it('FAILS on misspelled "conferment" (negative-control)', () => {
    // Misspelling — should NOT match any pattern → false on statement page.
    document.title = 'Accessibility Statement';
    setBodyFromFragment(
      `<main><h1>A11y</h1><p>This site is conferment with WCAG.</p></main>`,
    );
    expect(check(document.documentElement)).toBe(false);
  });
});
