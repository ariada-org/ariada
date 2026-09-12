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

  it('grows with the input rather than with its square', () => {
    // The property is the shape of the growth, not a number of milliseconds.
    //
    // This used to assert "under 200ms on a 100k input", which encodes the
    // speed of the machine that wrote it: under coverage instrumentation the
    // same code took 243ms and the suite reported a defect that was not there.
    // A budget answers "was this machine fast enough"; the question asked is
    // "is the work linear".
    //
    // So: multiply the input by ten. Linear work grows about tenfold, quadratic
    // about a hundredfold, and forty sits in the middle of that window.
    //
    // Four times the input was tried first and the window it leaves — between
    // four and sixteen — turned out to be too narrow to survive the coverage
    // sweep, which runs four packages at once: the ratio wandered into it on a
    // loaded machine and the package was recorded as unable to report coverage.
    // A wider spread costs a little more time and buys a verdict that does not
    // depend on what else the machine is doing.
    // Measured per operation, with the batch size chosen for the input.
    //
    // One normalisation of the smaller input takes well under a millisecond,
    // which is the same order as a single descheduling, so a lone reading is
    // mostly noise. Repeating it lifts the measurement above that floor. But
    // repeating the LARGER input the same number of times made the test slow
    // enough to exceed its own five-second limit under the coverage sweep, and
    // it began failing on a timeout rather than on the ratio — the second time
    // this test has failed for a reason it is not about.
    //
    // So each size gets the number of repetitions it needs — a hundred for the
    // smaller, two for the larger, so that each batch lands in the milliseconds
    // rather than the microseconds — and the times are divided by that number.
    // What is compared is the cost of ONE call at each size, which is what the
    // ratio was always meant to be.
    const izmerit = (probelov: number, povtorov: number): number => {
      const input = `div${' '.repeat(probelov)}span:nth-child(2)`;
      const start = performance.now();
      let out = '';
      for (let i = 0; i < povtorov; i += 1) out = normaliseSelector(input);
      const elapsed = performance.now() - start;
      // The normalised output collapses whitespace, so the nth-child ends up at
      // depth 2 (one space run = one combinator boundary) and is preserved.
      expect(out).toContain(':nth-child(2)');
      return elapsed / povtorov;
    };

    // The cheapest of three, because noise is one-sided: every disturbance makes
    // a run slower, so the smallest observation is closest to the cost itself.
    const deshevle_vsego = (probelov: number, povtorov: number, raz = 3): number => {
      let luchshee = Number.POSITIVE_INFINITY;
      for (let i = 0; i < raz; i += 1) luchshee = Math.min(luchshee, izmerit(probelov, povtorov));
      return luchshee;
    };

    izmerit(25_000, 1); // warm the code path
    const maloe = Math.max(deshevle_vsego(25_000, 100), 0.0005);
    const bolshoe = deshevle_vsego(250_000, 2);

    expect(bolshoe / maloe).toBeLessThan(40);
    // An explicit budget: this case measures, so it is genuinely slower than its
    // neighbours, and the default limit is a default rather than a statement
    // about it. It failed on that limit under the coverage sweep once already.
  }, 30_000);

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
