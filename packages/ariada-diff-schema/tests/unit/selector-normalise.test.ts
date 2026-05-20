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
