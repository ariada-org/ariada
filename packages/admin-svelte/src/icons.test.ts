// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: Apache-2.0
//
// Guard: the icon builder takes both of its arguments as coming from outside,
// because they do — a consumer of this package passes them and the result is
// put into markup.
//
// Two ways in, and neither needed a hostile consumer to be worth closing. A
// size that is not a number is written into an attribute value, so a string
// carrying a quote of its own closes the attribute and opens whatever comes
// next. And a key looked up on a plain object reaches the prototype, where
// `constructor` answers with a function that is then stringified into the
// drawing — a name a consumer could hold by accident, having read it off a
// data row.
import { describe, expect, it } from 'vitest';

import { actionIconSvg } from './icons';

describe('the size of an icon', () => {
  it('is a number in the markup, whatever it arrived as', () => {
    const svg = actionIconSvg('approve', '14" onload="alert(1)' as unknown as number);

    expect(svg).not.toContain('onload');
    expect(svg).toContain('width="14"');
  });

  it('stays inside sane bounds rather than trusting what it is given', () => {
    expect(actionIconSvg('approve', 0)).toContain('width="1"');
    expect(actionIconSvg('approve', 10_000)).toContain('width="512"');
    expect(actionIconSvg('approve', Number.NaN)).toContain('width="14"');
  });

  it('is still the size that was asked for in the ordinary case', () => {
    expect(actionIconSvg('approve', 20)).toContain('width="20" height="20"');
  });
});

describe('the key of an icon', () => {
  it('does not reach the prototype for its drawing', () => {
    for (const key of ['constructor', 'toString', 'valueOf', '__proto__']) {
      const svg = actionIconSvg(key);
      expect(svg).not.toContain('function');
      expect(svg).not.toContain('native code');
      expect(svg).toContain('<circle cx="12" cy="12" r="9"/>'); // the fallback dot
    }
  });

  it('still draws the icon a known action asks for', () => {
    expect(actionIconSvg('approve')).toContain('M4 12.5 9.5 18 20 6.5');
  });
});
