// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { describe, it, expect, beforeEach } from 'vitest';

import { setBodyFromFragment, resetBody } from '../../test-utils.js';

import { check } from './statement-feedback-mechanism.js';

describe('statement/feedback-mechanism-present — check', () => {
  beforeEach(() => {
    resetBody();
    document.title = '';
  });

  it('FAILS when statement has no feedback contact', () => {
    document.title = 'Accessibility Statement';
    setBodyFromFragment(`<main><h1>Accessibility</h1><p>We do our best.</p></main>`);
    expect(check(document.documentElement)).toBe(false);
  });

  it('PASSES with mailto: link', () => {
    document.title = 'Accessibility Statement';
    setBodyFromFragment(
      `<main><h1>A11y</h1><a href="mailto:access@example.com">Email us</a></main>`,
    );
    expect(check(document.documentElement)).toBe(true);
  });

  it('PASSES with tel: link', () => {
    document.title = 'Accessibility Statement';
    setBodyFromFragment(`<main><h1>A11y</h1><a href="tel:+46812345678">Call us</a></main>`);
    expect(check(document.documentElement)).toBe(true);
  });

  it('PASSES with /contact link', () => {
    document.title = 'Accessibility Statement';
    setBodyFromFragment(`<main><h1>A11y</h1><a href="/contact">Contact form</a></main>`);
    expect(check(document.documentElement)).toBe(true);
  });

  it('PASSES on Finnish /palaute', () => {
    document.title = 'Saavutettavuusseloste';
    setBodyFromFragment(`<main><h1>Saavutettavuus</h1><a href="/palaute">Anna palautetta</a></main>`);
    expect(check(document.documentElement)).toBe(true);
  });

  it('PASSES with bare email text in body', () => {
    document.title = 'Accessibility Statement';
    setBodyFromFragment(
      `<main><h1>A11y</h1><p>Report issues to a11y@example.org.</p></main>`,
    );
    expect(check(document.documentElement)).toBe(true);
  });

  // Edge cases

  it('PASSES on Swedish /kontakt path', () => {
    // Multilingual contact-path coverage — Swedish "kontakt".
    document.title = 'Tillgänglighet';
    setBodyFromFragment(
      `<main><h1>Tillgänglighet</h1><a href="/kontakt">Kontakta oss</a></main>`,
    );
    expect(check(document.documentElement)).toBe(true);
  });

  it('SKIPS non-statement page with no contact info', () => {
    // Confirm rule skips when isStatementPage()=false even when body is empty.
    document.title = 'Marketing Page';
    setBodyFromFragment(`<main><h1>Buy now!</h1></main>`);
    expect(check(document.documentElement)).toBe(true);
  });

  // Boundary and locale variants

  it('PASSES Norwegian /kontakt path', () => {
    document.title = 'Tilgjengelighetserklæring';
    setBodyFromFragment(
      `<main><h1>Tilgjengelighet</h1><a href="/kontakt">Kontakt oss</a></main>`,
    );
    expect(check(document.documentElement)).toBe(true);
  });

  it('PASSES with international tel link (+44 UK)', () => {
    document.title = 'Accessibility Statement';
    setBodyFromFragment(
      `<main><h1>A11y</h1><a href="tel:+442012345678">Call us</a></main>`,
    );
    expect(check(document.documentElement)).toBe(true);
  });

  it('PASSES with mailto including subject', () => {
    document.title = 'Accessibility Statement';
    setBodyFromFragment(
      `<main><h1>A11y</h1><a href="mailto:a11y@example.com?subject=Issue">Report</a></main>`,
    );
    expect(check(document.documentElement)).toBe(true);
  });

  it('FAILS empty statement page with no contact at all', () => {
    document.title = 'Accessibility Statement';
    setBodyFromFragment(`<main></main>`);
    expect(check(document.documentElement)).toBe(false);
  });

  it('PASSES deeply nested mailto link (10+ levels)', () => {
    document.title = 'Accessibility Statement';
    setBodyFromFragment(`
      <main><h1>A11y</h1>
        <div><div><div><div><div><div><div><div><div><div>
          <a href="mailto:contact@example.com">Email</a>
        </div></div></div></div></div></div></div></div></div></div>
      </main>
    `);
    expect(check(document.documentElement)).toBe(true);
  });

  it('PASSES with Cyrillic email address text', () => {
    document.title = 'Accessibility Statement';
    setBodyFromFragment(
      `<main><h1>A11y</h1><p>Сообщить: support@example.com</p></main>`,
    );
    expect(check(document.documentElement)).toBe(true);
  });

  it('PASSES with multiple contact channels (email + tel + form)', () => {
    document.title = 'Accessibility Statement';
    setBodyFromFragment(`
      <main><h1>A11y</h1>
        <a href="mailto:a@b.com">Email</a>
        <a href="tel:+1234567">Phone</a>
        <a href="/contact">Form</a>
      </main>
    `);
    expect(check(document.documentElement)).toBe(true);
  });
});
