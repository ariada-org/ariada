// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { describe, it, expect, beforeEach } from 'vitest';

import { setBodyFromFragment, resetBody } from '../../test-utils.js';

import { check } from './statement-standard-reference.js';

describe('statement/standard-reference — check', () => {
  beforeEach(() => {
    resetBody();
    document.title = '';
  });

  it('FAILS without standard reference', () => {
    document.title = 'Accessibility Statement';
    setBodyFromFragment(`<main><h1>A11y</h1><p>We try to be accessible.</p></main>`);
    expect(check(document.documentElement)).toBe(false);
  });

  it('PASSES with "WCAG 2.2 AA"', () => {
    document.title = 'Accessibility Statement';
    setBodyFromFragment(
      `<main><h1>A11y</h1><p>This site conforms to WCAG 2.2 level AA.</p></main>`,
    );
    expect(check(document.documentElement)).toBe(true);
  });

  it('PASSES with "WCAG 2.1 AA" (grandfathered)', () => {
    document.title = 'Accessibility Statement';
    setBodyFromFragment(`<main><h1>A11y</h1><p>WCAG 2.1 AA conformance.</p></main>`);
    expect(check(document.documentElement)).toBe(true);
  });

  it('PASSES with "EN 301 549 v3.2.1"', () => {
    document.title = 'Accessibility Statement';
    setBodyFromFragment(
      `<main><h1>A11y</h1><p>Tested against EN 301 549 v3.2.1.</p></main>`,
    );
    expect(check(document.documentElement)).toBe(true);
  });

  it('SKIPS non-statement pages', () => {
    document.title = 'Home';
    setBodyFromFragment(`<main><h1>Home</h1></main>`);
    expect(check(document.documentElement)).toBe(true);
  });

  // Edge cases

  it('PASSES with bare "EN 301 549" (no version suffix)', () => {
    // STANDARD_RE accepts the standard name without explicit version.
    document.title = 'Accessibility Statement';
    setBodyFromFragment(
      `<main><h1>A11y</h1><p>Audited against EN 301 549.</p></main>`,
    );
    expect(check(document.documentElement)).toBe(true);
  });

  it('FAILS when only "WCAG" appears without version number', () => {
    // STANDARD_RE requires WCAG to be followed by a version (2.0/2.1/2.2).
    document.title = 'Accessibility Statement';
    setBodyFromFragment(
      `<main><h1>A11y</h1><p>We follow WCAG guidelines closely.</p></main>`,
    );
    expect(check(document.documentElement)).toBe(false);
  });

  // Boundary and locale variants

  it('PASSES with "WCAG 2.0 A" (lowest version still recognized)', () => {
    document.title = 'Accessibility Statement';
    setBodyFromFragment(
      `<main><h1>A11y</h1><p>WCAG 2.0 level A conformance.</p></main>`,
    );
    expect(check(document.documentElement)).toBe(true);
  });

  it('PASSES with EN 301 549 v3.2.2 (newer minor version)', () => {
    document.title = 'Accessibility Statement';
    setBodyFromFragment(
      `<main><h1>A11y</h1><p>Audited against EN 301 549 v3.2.2.</p></main>`,
    );
    expect(check(document.documentElement)).toBe(true);
  });

  it('PASSES with WCAG 2.2 AAA (level AAA)', () => {
    document.title = 'Accessibility Statement';
    setBodyFromFragment(
      `<main><h1>A11y</h1><p>We meet WCAG 2.2 AAA.</p></main>`,
    );
    expect(check(document.documentElement)).toBe(true);
  });

  it('PASSES Norwegian statement page with WCAG reference', () => {
    document.title = 'Tilgjengelighetserklæring';
    setBodyFromFragment(
      `<main><h1>Tilgjengelighet</h1><p>Nettstedet følger WCAG 2.1 AA.</p></main>`,
    );
    expect(check(document.documentElement)).toBe(true);
  });

  it('SKIPS empty statement page', () => {
    document.title = 'Accessibility Statement';
    setBodyFromFragment(`<main></main>`);
    expect(check(document.documentElement)).toBe(false);
  });

  it('PASSES deeply nested standard reference (10+ levels)', () => {
    document.title = 'Accessibility Statement';
    setBodyFromFragment(`
      <main><h1>A11y</h1>
        <div><div><div><div><div><div><div><div><div><div>
          <p>Conforms to WCAG 2.2 AA.</p>
        </div></div></div></div></div></div></div></div></div></div>
      </main>
    `);
    expect(check(document.documentElement)).toBe(true);
  });

  it('PASSES with both WCAG and EN 301 549 referenced', () => {
    document.title = 'Accessibility Statement';
    setBodyFromFragment(
      `<main><h1>A11y</h1><p>Conforms to WCAG 2.2 AA and EN 301 549 v3.2.1.</p></main>`,
    );
    expect(check(document.documentElement)).toBe(true);
  });
});
