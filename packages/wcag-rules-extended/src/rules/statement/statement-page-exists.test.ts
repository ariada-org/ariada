// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { describe, it, expect, beforeEach } from 'vitest';

import { setBodyFromFragment, resetBody } from '../../test-utils.js';

import { check } from './statement-page-exists.js';

describe('statement/page-link-from-footer — check', () => {
  beforeEach(() => resetBody());

  it('FAILS when page has no link to accessibility statement', () => {
    const doc = setBodyFromFragment(`
      <main>
        <h1>Home</h1>
        <footer>
          <a href="/about">About</a>
          <a href="/contact">Contact</a>
        </footer>
      </main>
    `);
    expect(check(doc.documentElement)).toBe(false);
  });

  it('PASSES when footer has link to /accessibility', () => {
    const doc = setBodyFromFragment(
      `<footer><a href="/accessibility">Accessibility</a></footer>`,
    );
    expect(check(doc.documentElement)).toBe(true);
  });

  it('PASSES on Swedish "/tillganglighet"', () => {
    const doc = setBodyFromFragment(
      `<footer><a href="/tillganglighet">Tillgänglighet</a></footer>`,
    );
    expect(check(doc.documentElement)).toBe(true);
  });

  it('PASSES on Finnish "/saavutettavuus"', () => {
    const doc = setBodyFromFragment(
      `<footer><a href="/saavutettavuus">Saavutettavuus</a></footer>`,
    );
    expect(check(doc.documentElement)).toBe(true);
  });

  it('PASSES on Finnish full path "/saavutettavuusseloste"', () => {
    const doc = setBodyFromFragment(
      `<footer><a href="/saavutettavuusseloste">Saavutettavuusseloste</a></footer>`,
    );
    expect(check(doc.documentElement)).toBe(true);
  });

  it('PASSES on absolute URL with /accessibility-statement', () => {
    const doc = setBodyFromFragment(
      `<footer><a href="https://example.com/accessibility-statement">Accessibility</a></footer>`,
    );
    expect(check(doc.documentElement)).toBe(true);
  });

  it('PASSES on /a11y short path', () => {
    const doc = setBodyFromFragment(`<a href="/a11y">a11y</a>`);
    expect(check(doc.documentElement)).toBe(true);
  });

  // Edge cases — Phase 1C revision

  it('PASSES when statement link has query string (e.g. UTM tags)', () => {
    // Anchor must allow ?/# after the path segment per CONVENTIONAL_PATHS regex.
    const doc = setBodyFromFragment(
      `<footer><a href="/accessibility?utm_source=footer">Accessibility</a></footer>`,
    );
    expect(check(doc.documentElement)).toBe(true);
  });

  it('FAILS when only similar but non-matching path exists ("/access" without "ibility")', () => {
    // Heuristic must not over-match on partial words.
    const doc = setBodyFromFragment(
      `<footer><a href="/access">Account access</a></footer>`,
    );
    expect(check(doc.documentElement)).toBe(false);
  });

  // Boundary / locale variants — Wave 2 expansion (LAGRANGE)

  it('PASSES Norwegian /tilgjengelighet path', () => {
    const doc = setBodyFromFragment(
      `<footer><a href="/tilgjengelighet">Tilgjengelighet</a></footer>`,
    );
    expect(check(doc.documentElement)).toBe(true);
  });

  it('PASSES Danish /tilgaengelighed path', () => {
    const doc = setBodyFromFragment(
      `<footer><a href="/tilgaengelighed">Tilgængelighed</a></footer>`,
    );
    expect(check(doc.documentElement)).toBe(true);
  });

  it('PASSES URL-encoded Swedish /tillg%C3%A4nglighet', () => {
    const doc = setBodyFromFragment(
      `<footer><a href="/tillg%C3%A4nglighet">Tillgänglighet</a></footer>`,
    );
    expect(check(doc.documentElement)).toBe(true);
  });

  it('PASSES German /erklaerung-zur-barrierefreiheit (bonus)', () => {
    const doc = setBodyFromFragment(
      `<footer><a href="/erklaerung-zur-barrierefreiheit">Erklärung</a></footer>`,
    );
    expect(check(doc.documentElement)).toBe(true);
  });

  it('PASSES French /declaration-accessibilite (bonus)', () => {
    const doc = setBodyFromFragment(
      `<footer><a href="/declaration-accessibilite">Déclaration</a></footer>`,
    );
    expect(check(doc.documentElement)).toBe(true);
  });

  it('PASSES with fragment after path (e.g. /a11y#summary)', () => {
    const doc = setBodyFromFragment(
      `<footer><a href="/a11y#summary">Accessibility</a></footer>`,
    );
    expect(check(doc.documentElement)).toBe(true);
  });

  it('PASSES with /a11y-statement path', () => {
    const doc = setBodyFromFragment(
      `<footer><a href="/a11y-statement">Statement</a></footer>`,
    );
    expect(check(doc.documentElement)).toBe(true);
  });

  it('FAILS empty body (no anchors)', () => {
    const doc = setBodyFromFragment(``);
    expect(check(doc.documentElement)).toBe(false);
  });

  it('PASSES deeply nested statement link (10+ levels)', () => {
    const doc = setBodyFromFragment(`
      <footer><div><div><div><div><div><div><div><div><div><div>
        <a href="/accessibility">Accessibility</a>
      </div></div></div></div></div></div></div></div></div></div></footer>
    `);
    expect(check(doc.documentElement)).toBe(true);
  });

  it('PASSES with mixed-case path /Accessibility (case-insensitive regex)', () => {
    const doc = setBodyFromFragment(
      `<footer><a href="/Accessibility">A11y</a></footer>`,
    );
    expect(check(doc.documentElement)).toBe(true);
  });

  it('FAILS when only /accessible (different word) is present', () => {
    const doc = setBodyFromFragment(
      `<footer><a href="/accessible">Accessible</a></footer>`,
    );
    expect(check(doc.documentElement)).toBe(false);
  });
});
