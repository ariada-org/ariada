// SPDX-License-Identifier: EUPL-1.2
import { describe, it, expect } from 'vitest';

import { normaliseSelector } from '../../src/selector-normalise.js';

describe('normaliseSelector', () => {
  it('strips auto-generated input IDs', () => {
    expect(normaliseSelector('#input-3f8a2')).toBe('*');
  });

  it('strips auto-generated component IDs', () => {
    expect(normaliseSelector('#comp-abc123')).toBe('*');
  });

  it('preserves semantic IDs', () => {
    expect(normaliseSelector('#main')).toBe('#main');
    expect(normaliseSelector('#search')).toBe('#search');
  });

  it('strips framework-injected class hashes', () => {
    expect(normaliseSelector('div.css-1q2w3e4')).toBe('div');
    expect(normaliseSelector('div.sc-abcdef')).toBe('div');
    expect(normaliseSelector('div.emotion-12abc456')).toBe('div');
  });

  it('preserves stable hand-written classes', () => {
    expect(normaliseSelector('div.btn')).toBe('div.btn');
    expect(normaliseSelector('button.primary')).toBe('button.primary');
  });

  it('generalises deep nth-child indices', () => {
    const input = 'main > section > div > ul > li:nth-child(5)';
    const out = normaliseSelector(input);
    expect(out).toBe('main > section > div > ul > li:nth-child(*)');
  });

  it('preserves shallow nth-child indices', () => {
    const input = 'main > li:nth-child(2)';
    expect(normaliseSelector(input)).toBe('main > li:nth-child(2)');
  });

  it('lowercases all components', () => {
    expect(normaliseSelector('MAIN > IMG.HERO')).toBe('main > img.hero');
  });

  it('collapses whitespace around combinators', () => {
    expect(normaliseSelector('main  >   img')).toBe('main > img');
    expect(normaliseSelector('a   +   b')).toBe('a + b');
    expect(normaliseSelector('a~b')).toBe('a ~ b');
  });

  it('preserves attribute predicates', () => {
    expect(normaliseSelector('button[aria-label]')).toBe('button[aria-label]');
    expect(normaliseSelector('input[type="text"]')).toBe('input[type="text"]');
  });

  it('preserves pseudo-classes', () => {
    expect(normaliseSelector('a:hover')).toBe('a:hover');
  });

  it('is idempotent', () => {
    const input = 'MAIN  >  IMG.css-1abc23   +  div.btn[role="button"]';
    const once = normaliseSelector(input);
    const twice = normaliseSelector(once);
    expect(twice).toBe(once);
  });

  it('respects strictIdRegex option', () => {
    const out = normaliseSelector('#widget_abc123', { strictIdRegex: true });
    expect(out).toBe('*');
  });

  it('handles empty selector', () => {
    expect(normaliseSelector('')).toBe('');
  });

  it('handles single tag', () => {
    expect(normaliseSelector('button')).toBe('button');
  });
});

// --- Security tests (CodeQL HIGH: js/polynomial-redos in depth counter) ---

describe('normaliseSelector – ReDoS resistance in nth-child depth counter', () => {
  // Depth values for representative selectors must be unchanged after the fix.

  it('counts depth correctly for a 5-level selector (exceeds default selectorDepth of 4)', () => {
    const input = 'main > section > div > ul > li:nth-child(5)';
    // Depth at the nth-child = 5 (5 combinator-separated segments), exceeds 4 → generalise
    expect(normaliseSelector(input)).toBe('main > section > div > ul > li:nth-child(*)');
  });

  it('counts depth correctly for a 2-level selector (under default selectorDepth)', () => {
    // 'main > li' has depth 2 — preserved
    expect(normaliseSelector('main > li:nth-child(2)')).toBe('main > li:nth-child(2)');
  });

  it('counts depth correctly for a selector exactly at the limit (depth 4)', () => {
    // 'a > b > c > d:nth-child(3)' — depth is 4, not > 4, so preserved
    const input = 'a > b > c > d:nth-child(3)';
    expect(normaliseSelector(input)).toBe('a > b > c > d:nth-child(3)');
  });

  it('generalises when depth is 5 (one over the limit)', () => {
    const input = 'a > b > c > d > e:nth-child(1)';
    expect(normaliseSelector(input)).toBe('a > b > c > d > e:nth-child(*)');
  });

  it('handles multiple nth-child occurrences in one selector', () => {
    // First nth-child at depth 2 (shallow — keep), second at depth 5 (deep — generalise)
    const input = 'nav > ul:nth-child(1) > section > div > span:nth-child(3)';
    const out = normaliseSelector(input);
    expect(out).toContain(':nth-child(1)');   // shallow one preserved
    expect(out).toContain(':nth-child(*)');    // deep one generalised
  });

  it('completes within 200ms on a 100k-space pathological input', () => {
    // The polynomial ReDoS pattern: growing prefix.match(/[ >+~]+/g) is O(n²)
    // on a long run of spaces. A linear replacement must finish in <200ms.
    const longSpaces = ' '.repeat(100_000);
    const input = `div${longSpaces}span:nth-child(2)`;
    const start = Date.now();
    const out = normaliseSelector(input);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(200);
    // The normalised output should have collapsed whitespace, so the nth-child
    // ends up at depth 2 (one space run = one combinator boundary) → preserved.
    expect(out).toContain(':nth-child(2)');
  });

  it('handles descandant combinator (space) as a depth boundary for nth-child', () => {
    // 'div span:nth-child(1)' — depth 2 (space combinator) → preserved
    expect(normaliseSelector('div span:nth-child(1)')).toBe('div span:nth-child(1)');
  });

  it('handles mixed combinator types in depth count', () => {
    // Mix >, +, ~ — all count as combinator boundaries
    const input = 'a > b + c ~ d > e:nth-child(7)';
    // 5 segments, depth 5 → generalise
    expect(normaliseSelector(input)).toBe('a > b + c ~ d > e:nth-child(*)');
  });
});

describe('normaliseSelector – byte-identical contract for adjacent combinators', () => {
  // Adjacent combinators (>>, ~~~, >+~) are invalid CSS but must still
  // normalise to single-spaced canonical form so the byte-identical
  // cross-implementation contract holds — the single-pass collapser must
  // not emit a double space where the prior regex chain squeezed one.
  it.each([
    ['a>>b', 'a > > b'],
    ['a~~~b', 'a ~ ~ ~ b'],
    ['a>+~b', 'a > + ~ b'],
    ['ul>>li', 'ul > > li'],
    ['>a', '> a'],
    ['div>p>span', 'div > p > span'],
  ])('normalises %j to %j with single spaces (no double space)', (input, expected) => {
    const out = normaliseSelector(input);
    expect(out).toBe(expected);
    expect(out).not.toMatch(/ {2,}/);
  });
});
