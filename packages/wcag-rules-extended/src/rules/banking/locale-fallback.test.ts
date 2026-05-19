// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { describe, it, expect, beforeEach } from 'vitest';

import { setBodyFromFragment, resetBody } from '../../test-utils.js';

import { check } from './locale-fallback.js';

describe('banking/locale-fallback — check', () => {
  beforeEach(() => {
    resetBody();
    document.documentElement.removeAttribute('lang');
  });

  it('SKIPS pages that are not Nordic-locale', () => {
    document.documentElement.setAttribute('lang', 'en');
    setBodyFromFragment(
      `<main><p>This is a long English paragraph that has the and with for your please content.</p></main>`,
    );
    expect(check(document.documentElement)).toBe(true);
  });

  it('FAILS when Swedish page has unmarked English paragraph', () => {
    document.documentElement.setAttribute('lang', 'sv');
    setBodyFromFragment(`
      <main>
        <p>Detta är svensk text. Du har många funktioner och konton hos oss.</p>
        <p>This is a longer English sentence with the words that and with for your please click here this that has have will.</p>
      </main>
    `);
    expect(check(document.documentElement)).toBe(false);
  });

  it('PASSES when English paragraph has lang="en" wrapper', () => {
    document.documentElement.setAttribute('lang', 'sv');
    setBodyFromFragment(`
      <main>
        <p>Detta är svensk text. Vi har många kontotjänster.</p>
        <p lang="en">This is a longer English sentence with the words that and with for your please click here this that has have will.</p>
      </main>
    `);
    expect(check(document.documentElement)).toBe(true);
  });

  it('SKIPS short non-Nordic blocks (under 80 chars)', () => {
    document.documentElement.setAttribute('lang', 'sv');
    setBodyFromFragment(`<main><p>Detta är svenska. Click here.</p></main>`);
    expect(check(document.documentElement)).toBe(true);
  });

  it('PASSES Finnish page with no foreign content', () => {
    document.documentElement.setAttribute('lang', 'fi');
    setBodyFromFragment(`
      <main><p>Tämä on suomenkielinen teksti. Verkkopankissa on monia toimintoja.</p></main>
    `);
    expect(check(document.documentElement)).toBe(true);
  });

  // Edge cases — Phase 1C revision

  it('PASSES when English paragraph nests another long English child (delegates to child)', () => {
    // When parent has child with text > 80 chars, parent skips and checks the child instead.
    document.documentElement.setAttribute('lang', 'sv');
    setBodyFromFragment(`
      <main>
        <p>Detta är svensk text. Vi har många funktioner.</p>
        <div>
          <p lang="en">This is a longer English sentence with the words that and with for your please click here this that has have will be done now.</p>
        </div>
      </main>
    `);
    expect(check(document.documentElement)).toBe(true);
  });

  it('SKIPS Norwegian Bokmål page with no foreign content', () => {
    // lang="nb" / "nn" / "no" all count as Nordic per NORDIC_LANGS set.
    document.documentElement.setAttribute('lang', 'nb');
    setBodyFromFragment(`
      <main><p>Dette er norsk tekst. Vi har en nettbank med mange funksjoner.</p></main>
    `);
    expect(check(document.documentElement)).toBe(true);
  });

  // Boundary / locale variants — Wave 2 expansion (LAGRANGE)

  it('SKIPS empty Nordic page (no blocks to scan)', () => {
    document.documentElement.setAttribute('lang', 'sv');
    setBodyFromFragment(`<main></main>`);
    expect(check(document.documentElement)).toBe(true);
  });

  it('FAILS Danish page with unmarked English block', () => {
    document.documentElement.setAttribute('lang', 'da');
    setBodyFromFragment(`
      <main>
        <p>Dette er dansk tekst. Vi har mange funktioner i netbank.</p>
        <p>This is a long English sentence with the words that and with for your please click here this that has have will.</p>
      </main>
    `);
    expect(check(document.documentElement)).toBe(false);
  });

  it('FAILS Finnish page with unmarked English block', () => {
    document.documentElement.setAttribute('lang', 'fi');
    setBodyFromFragment(`
      <main>
        <p>Tämä on suomenkielinen teksti. Verkkopankissa on monia toimintoja.</p>
        <p>This is a long English sentence with the words that and with for your please click here this that has have will.</p>
      </main>
    `);
    expect(check(document.documentElement)).toBe(false);
  });

  it('FAILS Norwegian "no" page with unmarked English block', () => {
    document.documentElement.setAttribute('lang', 'no');
    setBodyFromFragment(`
      <main>
        <p>Dette er norsk tekst. Vi har en nettbank.</p>
        <p>This is a long English sentence with the words that and with for your please click here this that has have will.</p>
      </main>
    `);
    expect(check(document.documentElement)).toBe(false);
  });

  it('PASSES Swedish page with English block ancestor lang="en"', () => {
    // Ancestor with lang="en" should be detected as the override.
    document.documentElement.setAttribute('lang', 'sv');
    setBodyFromFragment(`
      <main>
        <p>Detta är svenska.</p>
        <section lang="en">
          <p>This is a long English sentence with the words that and with for your please click here this that has have will.</p>
        </section>
      </main>
    `);
    expect(check(document.documentElement)).toBe(true);
  });

  it('FAILS Swedish page when English block has lang="sv" override (still Nordic)', () => {
    // lang="sv" on the block is Nordic, not a foreign-language marker — must fail.
    document.documentElement.setAttribute('lang', 'sv');
    setBodyFromFragment(`
      <main>
        <p>Detta är svenska.</p>
        <p lang="sv">This is a long English sentence with the words that and with for your please click here this that has have will.</p>
      </main>
    `);
    expect(check(document.documentElement)).toBe(false);
  });

  it('SKIPS English page (lang="en") regardless of content (rule is Nordic-only)', () => {
    document.documentElement.setAttribute('lang', 'en');
    setBodyFromFragment(`<main><p>Detta är en svensk text som är mycket lång och har många ord och saker att säga.</p></main>`);
    expect(check(document.documentElement)).toBe(true);
  });

  it('PASSES at max-depth nesting (10+ levels) Swedish-only content', () => {
    document.documentElement.setAttribute('lang', 'sv');
    setBodyFromFragment(
      `<div><div><div><div><div><div><div><div><div><div><p>Detta är svensk text. Vi har många kontotjänster och funktioner för dig som kund.</p></div></div></div></div></div></div></div></div></div></div>`,
    );
    expect(check(document.documentElement)).toBe(true);
  });

  it('PASSES Swedish page with very long Swedish-only block (no English)', () => {
    document.documentElement.setAttribute('lang', 'sv');
    setBodyFromFragment(
      `<main><p>Detta är en mycket lång svensk text som handlar om internetbank och dess funktioner och tjänster för svenska kunder och företag i Sverige och resten av Norden idag.</p></main>`,
    );
    expect(check(document.documentElement)).toBe(true);
  });

  it('PASSES Swedish page with English-styled but Swedish-content block', () => {
    // Even if a long block exists, if isLikelyEnglish returns false (fewer than 4 EN_DISTINCT words), no failure.
    document.documentElement.setAttribute('lang', 'sv');
    setBodyFromFragment(`
      <main>
        <p>Detta är svensk text.</p>
        <p>Internetbanken erbjuder många funktioner och tjänster för dig som kund hos oss idag.</p>
      </main>
    `);
    expect(check(document.documentElement)).toBe(true);
  });
});
