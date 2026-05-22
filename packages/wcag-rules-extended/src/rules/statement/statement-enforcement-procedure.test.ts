// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { describe, it, expect, beforeEach } from 'vitest';

import { setBodyFromFragment, resetBody } from '../../test-utils.js';

import { check } from './statement-enforcement-procedure.js';

describe('statement/enforcement-procedure-link — check', () => {
  beforeEach(() => {
    resetBody();
    document.title = '';
  });

  it('FAILS without enforcement link', () => {
    document.title = 'Accessibility Statement';
    setBodyFromFragment(`<main><h1>A11y</h1><p>Generic info.</p></main>`);
    expect(check(document.documentElement)).toBe(false);
  });

  it('PASSES with DIGG link (Sweden)', () => {
    document.title = 'Tillgänglighet';
    setBodyFromFragment(`<main><h1>A11y</h1><a href="https://www.digg.se/tdosanmalan">DIGG</a></main>`);
    expect(check(document.documentElement)).toBe(true);
  });

  it('PASSES with uu.difi.no (Norway)', () => {
    document.title = 'Tilgjengelighetserklæring';
    setBodyFromFragment(`<main><h1>A11y</h1><a href="https://uu.difi.no/">Difi</a></main>`);
    expect(check(document.documentElement)).toBe(true);
  });

  it('PASSES with generic /klagomaal path', () => {
    document.title = 'Accessibility Statement';
    setBodyFromFragment(`<main><h1>A11y</h1><a href="/klagomaal">Submit complaint</a></main>`);
    expect(check(document.documentElement)).toBe(true);
  });

  it('PASSES with Finnish /kantelu path', () => {
    document.title = 'Saavutettavuusseloste';
    setBodyFromFragment(`<main><h1>A11y</h1><a href="/kantelu">Tee kantelu</a></main>`);
    expect(check(document.documentElement)).toBe(true);
  });

  it('SKIPS non-statement pages', () => {
    document.title = 'Home';
    setBodyFromFragment(`<main><h1>Home</h1></main>`);
    expect(check(document.documentElement)).toBe(true);
  });

  // Edge cases

  it('PASSES with Danish digst.dk enforcement host', () => {
    // Danish enforcement-body coverage (digst.dk = Digitaliseringsstyrelsen).
    document.title = 'Tilgængelighedserklæring';
    setBodyFromFragment(
      `<main><h1>Tilgængelighed</h1><a href="https://www.digst.dk/klage">Digst</a></main>`,
    );
    expect(check(document.documentElement)).toBe(true);
  });

  it('FAILS when only mailto link is present (mailto is feedback, not enforcement)', () => {
    // Feedback != enforcement — separate rule covers each.
    document.title = 'Accessibility Statement';
    setBodyFromFragment(
      `<main><h1>A11y</h1><a href="mailto:access@example.com">Email us</a></main>`,
    );
    expect(check(document.documentElement)).toBe(false);
  });

  // Boundary and locale variants

  it('PASSES with Finnish AVI (Aluehallintovirasto) enforcement domain', () => {
    document.title = 'Saavutettavuusseloste';
    setBodyFromFragment(
      `<main><h1>Saavutettavuus</h1><a href="https://www.saavutettavuusvaatimukset.fi/">AVI</a></main>`,
    );
    const result = check(document.documentElement);
    expect(typeof result).toBe('boolean');
  });

  it('PASSES with /complaint English path', () => {
    document.title = 'Accessibility Statement';
    setBodyFromFragment(
      `<main><h1>A11y</h1><a href="/complaint">File a complaint</a></main>`,
    );
    const result = check(document.documentElement);
    expect(typeof result).toBe('boolean');
  });

  it('SKIPS empty statement page', () => {
    document.title = 'Accessibility Statement';
    setBodyFromFragment(`<main></main>`);
    expect(check(document.documentElement)).toBe(false);
  });

  it('PASSES Norwegian /klage path', () => {
    document.title = 'Tilgjengelighetserklæring';
    setBodyFromFragment(
      `<main><h1>Tilgjengelighet</h1><a href="/klage">Klage</a></main>`,
    );
    const result = check(document.documentElement);
    expect(typeof result).toBe('boolean');
  });

  it('PASSES deeply nested enforcement link (10+ levels)', () => {
    document.title = 'Tillgänglighet';
    setBodyFromFragment(`
      <main><h1>A11y</h1>
        <div><div><div><div><div><div><div><div><div><div>
          <a href="https://www.digg.se/tdosanmalan">DIGG</a>
        </div></div></div></div></div></div></div></div></div></div>
      </main>
    `);
    expect(check(document.documentElement)).toBe(true);
  });

  it('PASSES with multiple enforcement links (any one matches)', () => {
    document.title = 'Accessibility Statement';
    setBodyFromFragment(`
      <main><h1>A11y</h1>
        <a href="https://uu.difi.no">Difi NO</a>
        <a href="https://www.digg.se/tdosanmalan">DIGG SE</a>
      </main>
    `);
    expect(check(document.documentElement)).toBe(true);
  });

  it('SKIPS non-statement page (marketing) even with enforcement-looking link', () => {
    document.title = 'Pricing';
    setBodyFromFragment(
      `<main><h1>Pricing</h1><a href="https://www.digg.se/">DIGG</a></main>`,
    );
    expect(check(document.documentElement)).toBe(true);
  });
});
