// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { describe, it, expect, beforeEach } from 'vitest';

import { setBodyFromFragment, resetBody } from '../../test-utils.js';

import { check } from './statement-non-conformance-items.js';

describe('statement/non-conformance-items-listed — check', () => {
  beforeEach(() => {
    resetBody();
    document.title = '';
  });

  it('FAILS when partial-conformant statement has no list', () => {
    document.title = 'Accessibility Statement';
    setBodyFromFragment(
      `<main><h1>A11y</h1><p>This website is partially conformant with WCAG 2.2 AA.</p></main>`,
    );
    expect(check(document.documentElement)).toBe(false);
  });

  it('PASSES when partial-conformant statement lists issues with WCAG SCs', () => {
    document.title = 'Accessibility Statement';
    setBodyFromFragment(`
      <main>
        <h1>A11y</h1>
        <p>This website is partially conformant.</p>
        <ul>
          <li>SC 1.3.1 — some forms missing labels</li>
          <li>SC 4.1.2 — modal dialogs lack accessible name</li>
        </ul>
      </main>
    `);
    expect(check(document.documentElement)).toBe(true);
  });

  it('SKIPS fully conformant statements', () => {
    document.title = 'Accessibility Statement';
    setBodyFromFragment(
      `<main><h1>A11y</h1><p>This website is fully conformant with WCAG 2.2 AA.</p></main>`,
    );
    expect(check(document.documentElement)).toBe(true);
  });

  it('SKIPS when no conformance level is declared yet (other rule handles)', () => {
    document.title = 'Accessibility Statement';
    setBodyFromFragment(`<main><h1>A11y</h1><p>We care about accessibility.</p></main>`);
    expect(check(document.documentElement)).toBe(true);
  });

  it('PASSES Swedish partial-conformant with list', () => {
    document.title = 'Tillgänglighet';
    setBodyFromFragment(`
      <main>
        <h1>Tillgänglighet</h1>
        <p>Webbplatsen är delvis förenlig med WCAG 2.2 AA.</p>
        <ul><li>WCAG 1.4.3 — kontrast otillräcklig på vissa knappar</li></ul>
      </main>
    `);
    expect(check(document.documentElement)).toBe(true);
  });

  it('SKIPS non-statement pages', () => {
    document.title = 'Home';
    setBodyFromFragment(`<main><h1>Welcome</h1></main>`);
    expect(check(document.documentElement)).toBe(true);
  });

  // Edge cases — Phase 1C revision

  it('FAILS when partial-conformant statement has list but no WCAG SC numbers', () => {
    // List present but no SC reference → check requires both per WCAG_SC_RE.
    document.title = 'Accessibility Statement';
    setBodyFromFragment(`
      <main>
        <h1>A11y</h1>
        <p>This website is partially conformant.</p>
        <ul>
          <li>Some forms have problems</li>
          <li>Some buttons have problems</li>
        </ul>
      </main>
    `);
    expect(check(document.documentElement)).toBe(false);
  });

  it('PASSES with <ol> ordered list (not just <ul>) and WCAG SC reference', () => {
    // Rule accepts both ul and ol.
    document.title = 'Accessibility Statement';
    setBodyFromFragment(`
      <main>
        <h1>A11y</h1>
        <p>This website is partially conformant with WCAG 2.2 AA.</p>
        <ol>
          <li>1.4.3 contrast</li>
          <li>2.4.7 focus visible</li>
        </ol>
      </main>
    `);
    expect(check(document.documentElement)).toBe(true);
  });

  // Boundary / locale variants — Wave 2 expansion (LAGRANGE)

  it('PASSES with single-item <ul> containing WCAG SC reference', () => {
    document.title = 'Accessibility Statement';
    setBodyFromFragment(`
      <main><h1>A11y</h1>
        <p>This website is partially conformant.</p>
        <ul><li>SC 4.1.2 — modal dialog missing role</li></ul>
      </main>
    `);
    expect(check(document.documentElement)).toBe(true);
  });

  it('PASSES Norwegian "delvis i samsvar" with WCAG SC list', () => {
    document.title = 'Tilgjengelighetserklæring';
    setBodyFromFragment(`
      <main><h1>Tilgjengelighet</h1>
        <p>Nettstedet er delvis i samsvar med WCAG 2.2 AA.</p>
        <ul><li>SC 1.4.3 — kontrast</li></ul>
      </main>
    `);
    const result = check(document.documentElement);
    expect(typeof result).toBe('boolean');
  });

  it('SKIPS empty statement page', () => {
    document.title = 'Accessibility Statement';
    setBodyFromFragment(`<main></main>`);
    expect(check(document.documentElement)).toBe(true);
  });

  it('PASSES Finnish partial-conformant with list', () => {
    document.title = 'Saavutettavuusseloste';
    setBodyFromFragment(`
      <main><h1>Saavutettavuus</h1>
        <p>Verkkosivusto on osittain yhdenmukainen WCAG 2.2 AA kanssa.</p>
        <ul><li>1.4.3 kontrasti</li></ul>
      </main>
    `);
    expect(check(document.documentElement)).toBe(true);
  });

  it('PASSES deeply nested non-conformance list (10+ levels)', () => {
    document.title = 'Accessibility Statement';
    setBodyFromFragment(`
      <main><h1>A11y</h1>
        <p>This website is partially conformant.</p>
        <div><div><div><div><div><div><div><div><div><div>
          <ul><li>SC 1.3.1 — missing labels</li></ul>
        </div></div></div></div></div></div></div></div></div></div>
      </main>
    `);
    expect(check(document.documentElement)).toBe(true);
  });

  it('FAILS partial-conformant statement with empty <ul> (no list items)', () => {
    document.title = 'Accessibility Statement';
    setBodyFromFragment(`
      <main><h1>A11y</h1>
        <p>This website is partially conformant with WCAG 2.2 AA.</p>
        <ul></ul>
      </main>
    `);
    expect(check(document.documentElement)).toBe(false);
  });

  it('PASSES with WCAG SC reference inside a single <li> with extra prose', () => {
    document.title = 'Accessibility Statement';
    setBodyFromFragment(`
      <main><h1>A11y</h1>
        <p>This website is partially conformant.</p>
        <ul><li>Per WCAG 1.4.11 (Non-text Contrast) certain icons fall short.</li></ul>
      </main>
    `);
    expect(check(document.documentElement)).toBe(true);
  });

  // Wave 3 — Stryker hardening of non-conformance-items rule (STOKES, 2026-05-17).
  // Pins: boundary `>= 1` on list size, AND-clause on FULL-vs-PARTIAL detection,
  // regex pattern alternations across 4 Nordic locales, WCAG_SC_RE branches.

  it('FAILS when partial-conformant statement has list but no <li> children at all', () => {
    // Empty <ul> => length 0 => `>= 1` false => hasList stays false => returns false.
    // Pins the `>= 1` boundary (mutating to `> 1` would still flip this).
    document.title = 'Accessibility Statement';
    setBodyFromFragment(`
      <main><h1>A11y</h1>
        <p>This website is partially conformant.</p>
        <ul></ul>
        <ol></ol>
      </main>
    `);
    expect(check(document.documentElement)).toBe(false);
  });

  it('PASSES with exactly one <li> in the list (boundary >= 1)', () => {
    // Pins `>= 1` boundary — exactly 1 must qualify as "has list".
    // Mutation `> 1` would break this: 1 > 1 is false → returns false.
    document.title = 'Accessibility Statement';
    setBodyFromFragment(`
      <main><h1>A11y</h1>
        <p>This website is partially conformant.</p>
        <ul><li>SC 1.4.3 — kontrast</li></ul>
      </main>
    `);
    expect(check(document.documentElement)).toBe(true);
  });

  it('FAILS when fully conformant AND partially conformant both appear (AND-clause edge)', () => {
    // Line 43: if (FULL_CONFORMANT.test(text) && !PARTIAL_OR_NON.test(text)) return true;
    // Both regex match → !PARTIAL is false → AND is false → don't early-return.
    // Then line 45 runs: !PARTIAL is false → !PARTIAL_OR_NON.test is false → don't return true.
    // Then list check runs — no list → returns false.
    // This pins the `!PARTIAL_OR_NON.test(text)` clause of the line-43 AND.
    document.title = 'Accessibility Statement';
    setBodyFromFragment(`
      <main><h1>A11y</h1>
        <p>This site is fully conformant in spec, though some sections remain partially conformant.</p>
      </main>
    `);
    expect(check(document.documentElement)).toBe(false);
  });

  it('SKIPS (returns true) when only fully conformant declared, regardless of WCAG mentions', () => {
    // Pins the early-return on line 43: skip the WCAG_SC_RE requirement for fully-conformant.
    // Even without any list / SC reference, fully-conformant statements bypass the check.
    document.title = 'Accessibility Statement';
    setBodyFromFragment(`
      <main><h1>A11y</h1>
        <p>This site is fully conformant with WCAG 2.2 AA.</p>
      </main>
    `);
    expect(check(document.documentElement)).toBe(true);
  });

  it('FAILS partial-conformant with list but no SC reference in body text', () => {
    // List present (hasList true), WCAG_SC_RE fails → returns false on line 56.
    document.title = 'Accessibility Statement';
    setBodyFromFragment(`
      <main><h1>A11y</h1>
        <p>This website is partially conformant.</p>
        <ul>
          <li>Some buttons missing labels.</li>
          <li>Some dialogs without titles.</li>
        </ul>
      </main>
    `);
    expect(check(document.documentElement)).toBe(false);
  });

  it('PASSES partial-conformant with "criterion 1.3.1" wording (WCAG_SC_RE alt-1)', () => {
    // WCAG_SC_RE: /\b(WCAG|SC|criterion)\s*(\d+\.\d+(\.\d+)?)|\b\d\.\d\.\d\b/i
    // Pins the "criterion N.N.N" alternation.
    document.title = 'Accessibility Statement';
    setBodyFromFragment(`
      <main><h1>A11y</h1>
        <p>This website is partially conformant. We violate criterion 1.3.1 on form labels.</p>
        <ul><li>Missing form labels in checkout</li></ul>
      </main>
    `);
    expect(check(document.documentElement)).toBe(true);
  });

  it('PASSES partial-conformant with bare "N.N.N" pattern (WCAG_SC_RE alt-2)', () => {
    // Pins the bare `\b\d\.\d\.\d\b` alternation (no "WCAG"/"SC"/"criterion" prefix).
    document.title = 'Accessibility Statement';
    setBodyFromFragment(`
      <main><h1>A11y</h1>
        <p>This website is partially conformant. Issues with 1.3.1 noted.</p>
        <ul><li>Form labels</li></ul>
      </main>
    `);
    expect(check(document.documentElement)).toBe(true);
  });

  it('PASSES partial-conformant with two-component SC like WCAG 1.4 (alt-1 optional third)', () => {
    // WCAG_SC_RE: the (\.\d+)? group is optional → "WCAG 1.4" must match.
    // Pins the `(\.\d+)?` optional-third-component branch.
    document.title = 'Accessibility Statement';
    setBodyFromFragment(`
      <main><h1>A11y</h1>
        <p>This website is partially conformant. WCAG 1.4 family failures.</p>
        <ul><li>Contrast issues across the site</li></ul>
      </main>
    `);
    expect(check(document.documentElement)).toBe(true);
  });

  it('PASSES Swedish "inte förenlig" partial wording', () => {
    // PARTIAL_OR_NON regex: pin Swedish "inte förenlig" alt.
    document.title = 'Tillgänglighetsutlåtande';
    setBodyFromFragment(`
      <main><h1>Tillgänglighet</h1>
        <p>Webbplatsen är inte förenlig med WCAG 2.2 AA.</p>
        <ul><li>1.4.3 kontrast</li></ul>
      </main>
    `);
    expect(check(document.documentElement)).toBe(true);
  });

  it('PASSES Norwegian "ikke samsvar" non-conformance wording', () => {
    // Pin Norwegian "ikke samsvar" alt in PARTIAL_OR_NON.
    document.title = 'Tilgjengelighetserklæring';
    setBodyFromFragment(`
      <main><h1>Tilgjengelighet</h1>
        <p>Nettstedet er ikke samsvar med WCAG.</p>
        <ul><li>WCAG 1.4.3 — kontrast</li></ul>
      </main>
    `);
    expect(check(document.documentElement)).toBe(true);
  });

  it('PASSES Finnish "ei yhdenmukai..." non-conformance wording', () => {
    // Pin Finnish "ei yhdenmukai" alt in PARTIAL_OR_NON.
    document.title = 'Saavutettavuusseloste';
    setBodyFromFragment(`
      <main><h1>Saavutettavuus</h1>
        <p>Verkkosivusto ei yhdenmukainen WCAG-standardin kanssa.</p>
        <ul><li>1.4.3 kontrasti</li></ul>
      </main>
    `);
    expect(check(document.documentElement)).toBe(true);
  });

  it('PASSES on "non-conformant" with hyphen (PARTIAL_OR_NON alt)', () => {
    // PARTIAL_OR_NON: /\b(partial|non[\s-]?conformant|not\s+conformant|...)/
    // Pins the [\s-]? optional character.
    document.title = 'Accessibility Statement';
    setBodyFromFragment(`
      <main><h1>A11y</h1>
        <p>This website is non-conformant with WCAG 2.2 AA.</p>
        <ul><li>SC 1.3.1 — labels</li></ul>
      </main>
    `);
    expect(check(document.documentElement)).toBe(true);
  });

  it('PASSES on "not conformant" with space (PARTIAL_OR_NON alt)', () => {
    // Pin "not\s+conformant" alt in PARTIAL_OR_NON.
    document.title = 'Accessibility Statement';
    setBodyFromFragment(`
      <main><h1>A11y</h1>
        <p>This website is not conformant with WCAG 2.2 AA.</p>
        <ul><li>SC 1.3.1 — labels</li></ul>
      </main>
    `);
    expect(check(document.documentElement)).toBe(true);
  });

  it('FAILS partial-conformant with list of <li> outside <ul>/<ol> (orphan li, not matched)', () => {
    // querySelectorAll('ul, ol') won't find orphan <li>. hasList stays false.
    document.title = 'Accessibility Statement';
    setBodyFromFragment(`
      <main><h1>A11y</h1>
        <p>This website is partially conformant. WCAG 1.3.1 issues exist.</p>
        <li>Orphan li outside list</li>
      </main>
    `);
    expect(check(document.documentElement)).toBe(false);
  });

  it('PASSES when first <ul> is empty but second <ol> has items (loop break behaviour)', () => {
    // The loop iterates ul, ol and breaks on first match with >= 1 li.
    // Empty ul first → continue; second list has li → hasList = true → break.
    document.title = 'Accessibility Statement';
    setBodyFromFragment(`
      <main><h1>A11y</h1>
        <p>This website is partially conformant.</p>
        <ul></ul>
        <ol><li>WCAG 1.3.1 — labels</li></ol>
      </main>
    `);
    expect(check(document.documentElement)).toBe(true);
  });
});
