// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Guards the markup stripping directly, which is the whole point of this file.
//
// There was already a test for it, written through the scanner, and it passed
// against both the correct implementation and the one it was written to catch.
// The reason is simple: for the inputs where the two differ, the scanner
// returns no findings at all, so both answers are the empty list. Three
// attempts produced three identical results before that became clear.
//
// A test that passes either way guards nothing, and a second one of the same
// shape only moves the problem. So the function is exported and asked directly.
//
// What separates the two implementations: ending a tag at the first `>` cuts
// inside a quoted attribute. `<img alt="a > b" src="/i.png">` then leaves
// ` b" src="/i.png">` behind, and a finding quotes that nonsense back at
// whoever reads it.

import { describe, expect, it } from 'vitest';

import { stripTags } from './scan.js';

describe('stripTags', () => {
  it('ends a tag where the tag ends, not at a bracket inside an attribute', () => {
    expect(stripTags('<img alt="a > b" src="/i.png">Accept terms')).toBe('Accept terms');
  });

  it('handles the same thing in single quotes', () => {
    expect(stripTags("<img alt='a > b' src='/i.png'>Accept")).toBe('Accept');
  });

  it('leaves a bracket alone when it is outside a tag', () => {
    // A refusal to touch anything would pass the two above and be worth
    // nothing, so what must survive is named too.
    expect(stripTags('5 > 3 and 2 < 4')).toBe('5 > 3 and 2 < 4');
  });

  it('removes ordinary tags', () => {
    expect(stripTags('<b>bold</b> and <i>italic</i>')).toBe('bold and italic');
  });

  it('copes with a tag that is never closed', () => {
    expect(stripTags('<span class="x">text')).toBe('text');
    expect(stripTags('before <img alt="unterminated')).toBe('before ');
  });

  it('returns an empty string for an empty one', () => {
    expect(stripTags('')).toBe('');
  });
});
