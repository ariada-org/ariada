// SPDX-License-Identifier: EUPL-1.2
//
// Property: normaliseSelector is idempotent —
//   normalise(normalise(x)) === normalise(x)

import { describe, it, expect } from 'vitest';

import { normaliseSelector } from '../../src/selector-normalise.js';

const SAMPLES: readonly string[] = [
  'main > img.hero',
  'MAIN  >  IMG.css-1abc23  + div.btn',
  '#input-3f8a2',
  '#main #search',
  'main > section > div > ul > li:nth-child(5)',
  'button[aria-label]',
  'button.css-abc123.sc-def456',
  'div.btn.primary',
  'a:hover',
  'input[type="text"][required]',
  'MAIN > SECTION > DIV > UL.list > LI:nth-child(1)',
  '   main    >    div   ',
  '*',
  '',
  'div',
];

describe('selector normalisation idempotence (property)', () => {
  it('every sample normalises to a fixed point', () => {
    for (const s of SAMPLES) {
      const once = normaliseSelector(s);
      const twice = normaliseSelector(once);
      expect(twice).toBe(once);
    }
  });

  it('random sample inputs reach a fixed point in one pass', () => {
    let s = 42;
    const rng = (): number => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s;
    };
    for (let i = 0; i < 500; i++) {
      const depth = (rng() % 5) + 1;
      const parts: string[] = [];
      for (let d = 0; d < depth; d++) {
        const tag = ['main', 'div', 'span', 'button', 'a'][rng() % 5] ?? 'div';
        const klass = rng() % 2 === 0 ? `.css-${(rng() % 100000).toString(16)}` : '';
        const nth = rng() % 3 === 0 ? `:nth-child(${(rng() % 9) + 1})` : '';
        parts.push(`${tag}${klass}${nth}`);
      }
      const sel = parts.join(' > ');
      const once = normaliseSelector(sel);
      const twice = normaliseSelector(once);
      expect(twice).toBe(once);
    }
  });
});
