// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { describe, it, expect, beforeEach } from 'vitest';

import { setBodyFromFragment, resetBody } from '../../test-utils.js';

import { check } from './lang-matches-locale.js';

describe('banking/lang-matches-locale — check', () => {
  beforeEach(() => {
    resetBody();
    document.documentElement.removeAttribute('lang');
  });

  const swedishParagraph = `
    Detta är en text på svenska. Vi har en internetbank och du kan logga in.
    Det finns många funktioner och kontot är säkert, men du måste verifiera.
    Eller välj en annan inloggningsmetod, för att det är säkrare med dubbel autentisering.
  `;

  const finnishParagraph = `
    Tämä on suomenkielinen teksti. Verkkopankissa on monia toimintoja ja palveluja.
    Että voit kirjautua sisään, sinun ovat oltava asiakas. Mutta minä autan sinua.
    Tai voit valita toisen kirjautumistavan, kanssa kaksivaiheinen vahvistus.
  `;

  it('FAILS when Swedish content has lang="en"', () => {
    document.documentElement.setAttribute('lang', 'en');
    setBodyFromFragment(`<main><p>${swedishParagraph}</p></main>`);
    expect(check(document.documentElement)).toBe(false);
  });

  it('PASSES when Swedish content has lang="sv"', () => {
    document.documentElement.setAttribute('lang', 'sv');
    setBodyFromFragment(`<main><p>${swedishParagraph}</p></main>`);
    expect(check(document.documentElement)).toBe(true);
  });

  it('PASSES when Swedish content has lang="sv-SE"', () => {
    document.documentElement.setAttribute('lang', 'sv-SE');
    setBodyFromFragment(`<main><p>${swedishParagraph}</p></main>`);
    expect(check(document.documentElement)).toBe(true);
  });

  it('FAILS when Finnish content has lang="sv"', () => {
    document.documentElement.setAttribute('lang', 'sv');
    setBodyFromFragment(`<main><p>${finnishParagraph}</p></main>`);
    expect(check(document.documentElement)).toBe(false);
  });

  it('PASSES when Finnish content has lang="fi"', () => {
    document.documentElement.setAttribute('lang', 'fi');
    setBodyFromFragment(`<main><p>${finnishParagraph}</p></main>`);
    expect(check(document.documentElement)).toBe(true);
  });

  it('SKIPS pages without enough signal', () => {
    setBodyFromFragment(`<main><p>Hello world</p></main>`);
    expect(check(document.documentElement)).toBe(true);
  });

  // Edge cases

  const norwegianParagraph = `
    Dette er en tekst på norsk. Vi har en nettbank og du kan logge inn.
    Det er mange funksjoner og kontoen er sikker, men du må verifisere.
    Eller velg en annen innloggingsmetode, for å være sikrere med dobbel autentisering.
  `;

  it('PASSES when Norwegian content has lang="nn" (Nynorsk variant equivalence)', () => {
    // The rule treats nb/nn/no as equivalent for Norwegian detection.
    document.documentElement.setAttribute('lang', 'nn');
    setBodyFromFragment(`<main><p>${norwegianParagraph}</p></main>`);
    expect(check(document.documentElement)).toBe(true);
  });

  it('FAILS when Swedish content has empty lang attribute', () => {
    // Empty lang= must not pass even when content is clearly Swedish.
    document.documentElement.setAttribute('lang', '');
    setBodyFromFragment(`<main><p>${swedishParagraph}</p></main>`);
    expect(check(document.documentElement)).toBe(false);
  });

  // Nordic-script gate (added 2026-05-15 — nb/da function words overlap English).

  it('SKIPS English page with Nordic-overlap function words but no å/ø/æ', () => {
    // The English text below contains plenty of `for`, `at`, `with`, `men`,
    // `det` etc. that would push nb / da counts past the threshold. Without
    // the Nordic-script gate, the rule would flag this lang="en" page.
    // With the gate, no å/ø/æ/ä/ö → rule short-circuits to pass.
    document.documentElement.setAttribute('lang', 'en');
    setBodyFromFragment(
      `<main><p>
        We provide accessibility scanning for European banks and fintech firms.
        Sign up for a free trial, log in, and see results in under five minutes.
        Banks across Europe trust us with their compliance reporting.
        For enterprise plans, contact our sales team — we offer custom SLA
        with dedicated support. Det means "the" in Nordic languages but in
        this English page it appears only twice. With our platform you can.
        Med er en preposisjon — but used here in English context only.
      </p></main>`,
    );
    expect(check(document.documentElement)).toBe(true);
  });

  it('FAILS Norwegian page with å + nb tokens when lang="en"', () => {
    // Nordic-script char (å) IS present, AND nb function words are above
    // threshold. Page declares lang="en" — that is a real mismatch the
    // rule must still catch.
    document.documentElement.setAttribute('lang', 'en');
    setBodyFromFragment(`<main><p>${norwegianParagraph}</p></main>`);
    expect(check(document.documentElement)).toBe(false);
  });

  // Boundary cases

  const danishParagraph = `
    Dette er en dansk tekst om netbank. Vi har mange funktioner og du
    kan logge ind med din NemID. Men hvis du glemmer adgangskoden er det
    nemt at nulstille den. Det er sikkert med to-faktor autentificering,
    og du kan altid kontakte vores kundeservice for hjælp ved problemer.
    Kontoen er beskyttet mod uautoriseret adgang ved hjælp af kryptering.
  `;

  it('PASSES Danish content with lang="da" (locale variant)', () => {
    document.documentElement.setAttribute('lang', 'da');
    setBodyFromFragment(`<main><p>${danishParagraph}</p></main>`);
    expect(check(document.documentElement)).toBe(true);
  });

  it('FAILS Danish content with lang="sv" (cross-Nordic mismatch)', () => {
    document.documentElement.setAttribute('lang', 'sv');
    setBodyFromFragment(`<main><p>${danishParagraph}</p></main>`);
    expect(check(document.documentElement)).toBe(false);
  });

  it('PASSES Norwegian content with lang="no" (umbrella ISO code)', () => {
    // "no" is the legacy ISO 639-1 umbrella code for Norwegian.
    document.documentElement.setAttribute('lang', 'no');
    setBodyFromFragment(`<main><p>${norwegianParagraph}</p></main>`);
    expect(check(document.documentElement)).toBe(true);
  });

  it('PASSES Norwegian content with lang="nb-NO" (BCP-47 region)', () => {
    document.documentElement.setAttribute('lang', 'nb-NO');
    setBodyFromFragment(`<main><p>${norwegianParagraph}</p></main>`);
    expect(check(document.documentElement)).toBe(true);
  });

  it('PASSES Finnish content with lang="fi-FI" (BCP-47 region)', () => {
    document.documentElement.setAttribute('lang', 'fi-FI');
    setBodyFromFragment(`<main><p>${finnishParagraph}</p></main>`);
    expect(check(document.documentElement)).toBe(true);
  });

  it('SKIPS empty body (no signal, no detection)', () => {
    // Empty body → no text → no detection → pass (defer to upstream html-has-lang).
    document.documentElement.setAttribute('lang', 'en');
    setBodyFromFragment(`<main></main>`);
    expect(check(document.documentElement)).toBe(true);
  });

  it('SKIPS body with only Arabic/Cyrillic Unicode (no Nordic script)', () => {
    // Non-Latin Unicode without Nordic chars → rule short-circuits.
    document.documentElement.setAttribute('lang', 'en');
    setBodyFromFragment(`<main><p>Это русский текст про банк</p><p>هذا نص عربي</p></main>`);
    expect(check(document.documentElement)).toBe(true);
  });

  it('FAILS Finnish content with lang="en" (regression — fi has its own script via ä/ö)', () => {
    document.documentElement.setAttribute('lang', 'en');
    setBodyFromFragment(`<main><p>${finnishParagraph}</p></main>`);
    expect(check(document.documentElement)).toBe(false);
  });

  it('PASSES at max-depth nesting (10+ levels) Swedish content with lang="sv"', () => {
    // Deeply wrapped content should still be detected.
    document.documentElement.setAttribute('lang', 'sv');
    setBodyFromFragment(
      `<div><div><div><div><div><div><div><div><div><div><p>${swedishParagraph}</p></div></div></div></div></div></div></div></div></div></div>`,
    );
    expect(check(document.documentElement)).toBe(true);
  });

  it('PASSES Swedish content with uppercase lang="SV" (case-insensitive normalization)', () => {
    document.documentElement.setAttribute('lang', 'SV');
    setBodyFromFragment(`<main><p>${swedishParagraph}</p></main>`);
    expect(check(document.documentElement)).toBe(true);
  });

  it('Handles Swedish text wrapped in multiple sibling paragraphs (text aggregation)', () => {
    // textContent walks the tree; multiple paragraphs accumulate signal.
    document.documentElement.setAttribute('lang', 'sv');
    const halves = swedishParagraph.split('.');
    const paragraphs = halves.map((h) => `<p>${h}.</p>`).join('\n');
    setBodyFromFragment(`<main>${paragraphs}</main>`);
    expect(check(document.documentElement)).toBe(true);
  });
});
