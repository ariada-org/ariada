// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { Window } from 'happy-dom';
import { describe, expect, it } from 'vitest';

import { createDomBoundingBoxResolver } from '../src/bbox-resolver.js';

function freshDoc(html: string): Document {
  const win = new Window({ url: 'http://test.local/' });
  win.document.write(html);
  return win.document as unknown as Document;
}

describe('createDomBoundingBoxResolver', () => {
  it('returns getBoundingClientRect output mapped to ariada bbox shape', async () => {
    const doc = freshDoc('<h1 id="title">Hi</h1>');
    // happy-dom returns zero-rects by default; stub one element to be sure
    // the resolver passes the values through verbatim.
    const el = doc.querySelector('#title');
    if (el) {
      (el as unknown as { getBoundingClientRect: () => DOMRect }).getBoundingClientRect = () =>
        ({ x: 5, y: 10, width: 200, height: 40 }) as DOMRect;
    }

    const resolver = createDomBoundingBoxResolver(doc);
    expect(await resolver.resolve('h1#title')).toEqual({ x: 5, y: 10, w: 200, h: 40 });
  });

  it('returns zero-bbox when selector matches nothing', async () => {
    const doc = freshDoc('<h1>Hi</h1>');
    const resolver = createDomBoundingBoxResolver(doc);
    expect(await resolver.resolve('.does-not-exist')).toEqual({ x: 0, y: 0, w: 0, h: 0 });
  });

  it('returns zero-bbox when querySelector throws (invalid selector)', async () => {
    const doc = freshDoc('<h1>Hi</h1>');
    const resolver = createDomBoundingBoxResolver(doc);
    expect(await resolver.resolve(':::invalid:::')).toEqual({ x: 0, y: 0, w: 0, h: 0 });
  });
});
