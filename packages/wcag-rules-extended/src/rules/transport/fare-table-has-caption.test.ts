// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { describe, it, expect, beforeEach } from 'vitest';

import { setBodyFromFragment, resetBody } from '../../test-utils.js';

import { check } from './fare-table-has-caption.js';

describe('transport/fare-table-has-caption — check', () => {
  beforeEach(() => resetBody());

  const table = (inner: string, selector = 'table') =>
    setBodyFromFragment(inner).querySelector(selector)!;

  it('PASSES a fare table with a caption', () => {
    expect(
      check(
        table(
          `<table data-fare-table>
             <caption>Single fares by zone</caption>
             <tbody><tr><td>Zone 1</td><td>€2.40</td></tr></tbody>
           </table>`,
        ),
      ),
    ).toBe(true);
  });

  it('PASSES a caption with nested markup text', () => {
    expect(
      check(
        table(
          `<table data-fare-table>
             <caption><strong>Fares</strong> by zone</caption>
             <tbody><tr><td>Zone 1</td><td>€2.40</td></tr></tbody>
           </table>`,
        ),
      ),
    ).toBe(true);
  });

  it('FAILS a fare table with no caption', () => {
    expect(
      check(
        table(
          `<table data-fare-table><tbody><tr><td>Zone 1</td><td>€2.40</td></tr></tbody></table>`,
        ),
      ),
    ).toBe(false);
  });

  it('FAILS a fare table with an empty caption', () => {
    expect(check(table(`<table data-fare-table><caption></caption></table>`))).toBe(false);
  });

  it('FAILS a caption with whitespace-only text', () => {
    expect(check(table(`<table data-fare-table><caption>   </caption></table>`))).toBe(false);
  });

  // Edge cases

  it('SKIPS a plain table without data-fare-table', () => {
    expect(
      check(table(`<table><caption>Random</caption><tbody></tbody></table>`)),
    ).toBe(true);
  });

  it('SKIPS a non-table element', () => {
    const node = setBodyFromFragment('<div data-fare-table>not a table</div>').querySelector(
      'div',
    )!;
    expect(check(node)).toBe(true);
  });

  it('FAILS a plain fare table even when an unrelated <caption> exists elsewhere', () => {
    // The caption must be a child of the fare table, not a sibling table's caption.
    const document = setBodyFromFragment(`
      <table><caption>Other table</caption></table>
      <table data-fare-table id="fares"><tbody><tr><td>€2.40</td></tr></tbody></table>
    `);
    expect(check(document.querySelector('#fares')!)).toBe(false);
  });

  it('FAILS when the only <caption> belongs to a NESTED table, not the fare table', () => {
    // The outer data-fare-table has no caption of its own; the caption sits in
    // an inner table. The outer price grid still lacks announced context.
    expect(
      check(
        table(
          `<table data-fare-table>
             <tbody><tr><td>
               <table><caption>Inner caption</caption><tbody><tr><td>x</td></tr></tbody></table>
             </td><td>€2.40</td></tr></tbody>
           </table>`,
          'table[data-fare-table]',
        ),
      ),
    ).toBe(false);
  });
});
