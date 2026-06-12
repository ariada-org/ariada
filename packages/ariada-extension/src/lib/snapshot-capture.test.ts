// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { describe, it, expect } from 'vitest';

import { captureSnapshot } from './snapshot-capture.js';

function docFromHtml(html: string): Document {
  return new DOMParser().parseFromString(html, 'text/html');
}

describe('captureSnapshot', () => {
  it('produces a PropertySnapshot carrying the scanId and url', () => {
    const doc = docFromHtml('<main><h1>Hi</h1></main>');
    const snap = captureSnapshot(doc, { scanId: 'scan-1', url: 'https://example.com/' });
    expect(snap.scanId).toBe('scan-1');
    expect(snap.url).toBe('https://example.com/');
    expect(typeof snap.timestamp).toBe('number');
  });

  it('captures every element into the domOutline with its node name and a selector', () => {
    const doc = docFromHtml('<main><h1>Hi</h1><p>Text</p></main>');
    const snap = captureSnapshot(doc, { scanId: 's', url: 'https://example.com/' });
    const names = snap.domOutline.map((e) => e.nodeName);
    expect(names).toContain('MAIN');
    expect(names).toContain('H1');
    expect(names).toContain('P');
    // every outline entry has a non-empty selector
    expect(snap.domOutline.every((e) => e.selector.length > 0)).toBe(true);
  });

  it('records element attributes so the accessibility domain can read alt text', () => {
    const doc = docFromHtml('<img src="a.png" alt="A cat" /><img src="b.png" />');
    const snap = captureSnapshot(doc, { scanId: 's', url: 'https://example.com/' });
    const imgs = snap.domOutline.filter((e) => e.nodeName === 'IMG');
    expect(imgs).toHaveLength(2);
    const withAlt = imgs.find((e) => e.attributes?.['alt'] === 'A cat');
    const withoutAlt = imgs.find((e) => e.attributes && !('alt' in e.attributes));
    expect(withAlt).toBeDefined();
    expect(withoutAlt).toBeDefined();
  });

  it('assigns stable unique nth-of-type selectors to sibling elements of the same tag', () => {
    const doc = docFromHtml('<ul><li>a</li><li>b</li><li>c</li></ul>');
    const snap = captureSnapshot(doc, { scanId: 's', url: 'https://example.com/' });
    const liSelectors = snap.domOutline.filter((e) => e.nodeName === 'LI').map((e) => e.selector);
    expect(new Set(liSelectors).size).toBe(3); // all selectors unique
  });

  it('includes the serialised html and an empty headers map (page context cannot read response headers)', () => {
    const doc = docFromHtml('<main><h1>Hi</h1></main>');
    const snap = captureSnapshot(doc, { scanId: 's', url: 'https://example.com/' });
    expect(snap.html).toContain('<h1>Hi</h1>');
    expect(typeof snap.headers).toBe('object');
  });
});
