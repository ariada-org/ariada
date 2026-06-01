// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { describe, it, expect, beforeEach } from 'vitest';

import { setBodyFromFragment, resetBody } from '../../test-utils.js';

import { check } from './timetable-has-header-cells.js';

describe('transport/timetable-has-header-cells — check', () => {
  beforeEach(() => resetBody());

  const table = (inner: string, selector = 'table') =>
    setBodyFromFragment(inner).querySelector(selector)!;

  it('PASSES a timetable with <th> in <thead>', () => {
    expect(
      check(
        table(
          `<table data-timetable>
             <thead><tr><th>Depart</th><th>Platform</th></tr></thead>
             <tbody><tr><td>10:05</td><td>3</td></tr></tbody>
           </table>`,
        ),
      ),
    ).toBe(true);
  });

  it('PASSES a timetable with <th scope="row">', () => {
    expect(
      check(
        table(
          `<table data-timetable>
             <tbody><tr><th scope="row">10:05</th><td>Platform 3</td></tr></tbody>
           </table>`,
        ),
      ),
    ).toBe(true);
  });

  it('PASSES a timetable with a <th> anywhere in the grid', () => {
    expect(
      check(
        table(
          `<table data-timetable>
             <tbody><tr><td>10:05</td><td>3</td></tr><tr><th>Total</th><td>2</td></tr></tbody>
           </table>`,
        ),
      ),
    ).toBe(true);
  });

  it('FAILS a timetable with only <td> cells', () => {
    expect(
      check(
        table(
          `<table data-timetable>
             <tbody><tr><td>Depart</td><td>Platform</td></tr><tr><td>10:05</td><td>3</td></tr></tbody>
           </table>`,
        ),
      ),
    ).toBe(false);
  });

  it('FAILS an empty timetable (no header cells)', () => {
    expect(check(table(`<table data-timetable></table>`))).toBe(false);
  });

  // Edge cases

  it('SKIPS a plain table without data-timetable', () => {
    expect(
      check(
        table(`<table><tbody><tr><td>10:05</td><td>3</td></tr></tbody></table>`),
      ),
    ).toBe(true);
  });

  it('SKIPS a non-table element', () => {
    const node = setBodyFromFragment('<div data-timetable>not a table</div>').querySelector('div')!;
    expect(check(node)).toBe(true);
  });

  it('PASSES a plain table that does declare headers but has data-timetable', () => {
    expect(
      check(
        table(
          `<table data-timetable><tr><th>Time</th></tr><tr><td>10:05</td></tr></table>`,
        ),
      ),
    ).toBe(true);
  });

  it('FAILS when the only <th> belongs to a NESTED table, not the timetable itself', () => {
    // The outer data-timetable has no header cell of its own; the <th> sits in
    // an inner table. The outer grid is still unnavigable, so this must fail.
    expect(
      check(
        table(
          `<table data-timetable>
             <tbody><tr><td>
               <table><thead><tr><th>Inner</th></tr></thead><tbody><tr><td>x</td></tr></tbody></table>
             </td><td>10:05</td></tr></tbody>
           </table>`,
          'table[data-timetable]',
        ),
      ),
    ).toBe(false);
  });
});
