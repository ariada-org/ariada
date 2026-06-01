// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { describe, it, expect, beforeEach } from 'vitest';

import { setBodyFromFragment, resetBody } from '../../test-utils.js';

import { check } from './reading-content-has-lang.js';

describe('ebooks/reading-content-has-lang — check', () => {
  beforeEach(() => resetBody());

  const find = (html: string, selector: string) =>
    setBodyFromFragment(html).querySelector(selector)!;

  it('PASSES an article with a valid lang="en"', () => {
    expect(check(find('<article lang="en">chapter</article>', 'article'))).toBe(true);
  });

  it('PASSES an article whose ancestor declares the lang', () => {
    expect(
      check(find('<div lang="sv"><article>chapter</article></div>', 'article')),
    ).toBe(true);
  });

  it('PASSES an article with a script-subtag lang="zh-Hant"', () => {
    expect(check(find('<article lang="zh-Hant">chapter</article>', 'article'))).toBe(true);
  });

  it('FAILS an article with no lang anywhere', () => {
    expect(check(find('<article>chapter</article>', 'article'))).toBe(false);
  });

  it('FAILS an article with an empty lang=""', () => {
    expect(check(find('<article lang="">chapter</article>', 'article'))).toBe(false);
  });

  it('FAILS an article with an invalid lang="english!"', () => {
    expect(check(find('<article lang="english!">chapter</article>', 'article'))).toBe(
      false,
    );
  });

  it('PASSES role="document" with a valid lang', () => {
    expect(
      check(find('<section role="document" lang="fr">chapter</section>', '[role="document"]')),
    ).toBe(true);
  });

  it('SKIPS a plain div with no reading-root signal', () => {
    expect(check(find('<div>just a div</div>', 'div'))).toBe(true);
  });

  it('PASSES a data-reading-content element with a valid lang', () => {
    expect(
      check(find('<section data-reading-content lang="de">chapter</section>', '[data-reading-content]')),
    ).toBe(true);
  });
});
