// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { describe, it, expect, beforeEach } from 'vitest';

import { setBodyFromFragment, resetBody } from '../../test-utils.js';

import { check } from './no-positive-tabindex-in-reading.js';

describe('ebooks/no-positive-tabindex-in-reading — check', () => {
  beforeEach(() => resetBody());

  const inArticle = (inner: string, selector: string) =>
    setBodyFromFragment(`<article>${inner}</article>`).querySelector(selector)!;

  it('PASSES tabindex="0" inside an article', () => {
    expect(check(inArticle('<a href="#" tabindex="0">link</a>', 'a'))).toBe(true);
  });

  it('PASSES tabindex="-1" inside an article', () => {
    expect(check(inArticle('<button tabindex="-1">x</button>', 'button'))).toBe(true);
  });

  it('FAILS tabindex="1" inside an article', () => {
    expect(check(inArticle('<a href="#" tabindex="1">link</a>', 'a'))).toBe(false);
  });

  it('FAILS tabindex="5" inside an article', () => {
    expect(check(inArticle('<input tabindex="5">', 'input'))).toBe(false);
  });

  it('SKIPS tabindex="1" NOT inside a reading root', () => {
    const node = setBodyFromFragment('<div><a href="#" tabindex="1">link</a></div>').querySelector(
      'a',
    )!;
    expect(check(node)).toBe(true);
  });

  it('PASSES a non-numeric tabindex inside an article', () => {
    expect(check(inArticle('<a href="#" tabindex="auto">link</a>', 'a'))).toBe(true);
  });

  it('SKIPS an element with no tabindex inside an article', () => {
    expect(check(inArticle('<a href="#">link</a>', 'a'))).toBe(true);
  });

  it('FAILS tabindex="2" inside a role="document" reading root', () => {
    const node = setBodyFromFragment(
      '<section role="document"><button tabindex="2">x</button></section>',
    ).querySelector('button')!;
    expect(check(node)).toBe(false);
  });

  it('PASSES tabindex="0" inside a data-reading-content root', () => {
    const node = setBodyFromFragment(
      '<section data-reading-content><a href="#" tabindex="0">link</a></section>',
    ).querySelector('a')!;
    expect(check(node)).toBe(true);
  });
});
