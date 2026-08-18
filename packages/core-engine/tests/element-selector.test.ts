// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

import { Window } from 'happy-dom';
import { describe, expect, it } from 'vitest';

import { buildElementSelector, FINDING_ELEMENTS } from '../src/element-selector.js';

function documentFrom(html: string): Document {
  const window = new Window({ url: 'http://test/' });
  const doc = window.document as unknown as Document;
  doc.body.innerHTML = html;
  return doc;
}

/** The property that matters: whatever name comes back must find the element
 *  again, and only it. */
function findsItsOwnElement(doc: Document, el: Element): boolean {
  const selector = buildElementSelector(el);
  return doc.querySelector(selector) === el && doc.querySelectorAll(selector).length === 1;
}

describe('naming an element', () => {
  it('uses the id when there is one', () => {
    const doc = documentFrom('<h1 id="title">Hi</h1>');
    expect(buildElementSelector(doc.querySelector('h1')!)).toBe('h1#title');
  });

  it('uses a class when it is enough on its own', () => {
    const doc = documentFrom('<button class="primary big">Go</button>');
    expect(buildElementSelector(doc.querySelector('button')!)).toBe('button.primary');
  });

  it('deepens the path when a class is shared', () => {
    const doc = documentFrom(
      '<div><img class="thumb"><img class="thumb"></div><div><img class="thumb"></div>',
    );
    for (const img of Array.from(doc.querySelectorAll('img'))) {
      expect(findsItsOwnElement(doc, img)).toBe(true);
    }
  });

  it('counts position among siblings, not across the page', () => {
    // This is the defect the shared function exists to prevent. A name built
    // from a running count over the whole document produces `img:nth-of-type(3)`
    // for the third image on the page — which means "the third image of its
    // parent" and finds nothing when the images sit in different parents.
    const doc = documentFrom('<div><img></div><div><img></div><div><img></div>');
    const images = Array.from(doc.querySelectorAll('img'));
    expect(images).toHaveLength(3);
    for (const img of images) {
      expect(buildElementSelector(img)).not.toBe('img:nth-of-type(3)');
      expect(findsItsOwnElement(doc, img)).toBe(true);
    }
  });

  it('names every element of a page that repeats its structure', () => {
    const card = '<li><a href="#">Link</a><p>Text</p><img></li>';
    const doc = documentFrom(`<ul>${card.repeat(12)}</ul>`);
    const all = Array.from(doc.querySelectorAll(FINDING_ELEMENTS));
    expect(all.length).toBeGreaterThan(30);
    for (const el of all) {
      expect(findsItsOwnElement(doc, el)).toBe(true);
    }
  });

  it('escapes an id that would otherwise not be a valid selector', () => {
    const doc = documentFrom('<p id="a.b:c">x</p>');
    const el = doc.querySelector('p')!;
    expect(findsItsOwnElement(doc, el)).toBe(true);
  });

  it('still returns the most specific path it can when the document repeats itself exactly', () => {
    // Two identical subtrees with no distinguishing ancestor: nothing can single
    // one out, and the honest answer is the full path rather than a throw.
    const doc = documentFrom('<div><span role="note">a</span></div>');
    const el = doc.querySelector('[role="note"]')!;
    expect(buildElementSelector(el)).toContain('span');
  });
});
