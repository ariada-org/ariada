// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { describe, it, expect, beforeEach } from 'vitest';

import { setBodyFromFragment, resetBody } from '../../test-utils.js';

import { check } from './text-spacing-overridable.js';

describe('ebooks/text-spacing-overridable — check', () => {
  beforeEach(() => resetBody());

  const element = (style: string) =>
    setBodyFromFragment(`<p style="${style}">chapter text</p>`).querySelector('p')!;

  it('PASSES plain inline spacing without !important', () => {
    expect(check(element('line-height: 1.5; letter-spacing: 0.1em'))).toBe(true);
  });

  it('PASSES an element with no spacing properties', () => {
    expect(check(element('color: black; margin: 0'))).toBe(true);
  });

  it('PASSES !important on an unrelated property (color)', () => {
    expect(check(element('color: black !important'))).toBe(true);
  });

  it('FAILS line-height with !important', () => {
    expect(check(element('line-height:1.2!important'))).toBe(false);
  });

  it('FAILS letter-spacing with !important', () => {
    expect(check(element('letter-spacing:0.1em !important'))).toBe(false);
  });

  it('FAILS word-spacing with whitespace in the bang (! important)', () => {
    expect(check(element('word-spacing:0.2em ! important'))).toBe(false);
  });

  it('is case-insensitive about property names and the important keyword', () => {
    expect(check(element('Line-Height: 1.4 !IMPORTANT'))).toBe(false);
  });

  it('FAILS when only one of several declarations is !important', () => {
    expect(
      check(element('color: black; line-height: 1.6 !important; margin: 0')),
    ).toBe(false);
  });

  it('PASSES when several declarations are present but none use !important', () => {
    expect(
      check(element('line-height: 1.6; letter-spacing: 0.05em; word-spacing: 0.1em')),
    ).toBe(true);
  });

  it('tolerates a malformed declaration with no colon', () => {
    expect(check(element('line-height 1.2 important'))).toBe(true);
  });

  it('SKIPS an element with no style attribute', () => {
    const node = setBodyFromFragment('<p>chapter text</p>').querySelector('p')!;
    expect(check(node)).toBe(true);
  });

  it('FAILS line-height!important alongside a trailing semicolon', () => {
    expect(check(element('line-height: 1.3 !important;'))).toBe(false);
  });
});
