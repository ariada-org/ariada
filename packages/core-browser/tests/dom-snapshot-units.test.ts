// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { Window } from 'happy-dom';
import { describe, expect, it } from 'vitest';

import { captureBrowserSnapshot } from '../src/dom-snapshot.js';

function freshDoc(html: string): Document {
  const win = new Window({ url: 'http://test.local/' });
  win.document.write(html);
  return win.document as unknown as Document;
}

describe('captureBrowserSnapshot — outline membership', () => {
  it('includes elements selected by their role attribute', async () => {
    const doc = freshDoc('<div role="alert">Heads up</div>');
    const snap = await captureBrowserSnapshot({ document: doc, scanId: 's' });
    const node = snap.domOutline.find((n) => n.nodeName === 'div');
    expect(node).toBeDefined();
  });

  it('includes elements selected by aria-label', async () => {
    const doc = freshDoc('<span aria-label="Close">x</span>');
    const snap = await captureBrowserSnapshot({ document: doc, scanId: 's' });
    expect(snap.domOutline.some((n) => n.nodeName === 'span')).toBe(true);
  });

  it('includes elements selected by tabindex', async () => {
    const doc = freshDoc('<div tabindex="0">Focusable</div>');
    const snap = await captureBrowserSnapshot({ document: doc, scanId: 's' });
    expect(snap.domOutline.some((n) => n.nodeName === 'div')).toBe(true);
  });

  it('includes the full set of interactive and structural tags', async () => {
    const doc = freshDoc(`
      <h2>H</h2><a href="#">A</a><button>B</button>
      <input><select></select><textarea></textarea><label>L</label><li>I</li>
    `);
    const snap = await captureBrowserSnapshot({ document: doc, scanId: 's' });
    const tags = new Set(snap.domOutline.map((n) => n.nodeName));
    for (const t of ['h2', 'a', 'button', 'input', 'select', 'textarea', 'label', 'li']) {
      expect(tags.has(t)).toBe(true);
    }
  });

  it('returns an empty outline for a document with no matching elements', async () => {
    const doc = freshDoc('<div><span>plain</span></div>');
    const snap = await captureBrowserSnapshot({ document: doc, scanId: 's' });
    // div/span without role/aria/tabindex are not in the selector set
    expect(snap.domOutline).toEqual([]);
  });
});

describe('captureBrowserSnapshot — selector uniqueness', () => {
  it('produces a selector that uniquely resolves back to each source element', async () => {
    const doc = freshDoc(`
      <ul>
        <li>one</li>
        <li>two</li>
        <li>three</li>
      </ul>
    `);
    const snap = await captureBrowserSnapshot({ document: doc, scanId: 's' });
    const items = snap.domOutline.filter((n) => n.nodeName === 'li');
    expect(items).toHaveLength(3);
    for (const item of items) {
      const matches = doc.querySelectorAll(item.selector);
      expect(matches.length).toBe(1);
    }
  });

  it('deepens the selector path when nth-of-type alone is ambiguous', async () => {
    const doc = freshDoc(`
      <section><button>first</button></section>
      <section><button>second</button></section>
    `);
    const snap = await captureBrowserSnapshot({ document: doc, scanId: 's' });
    const buttons = snap.domOutline.filter((n) => n.nodeName === 'button');
    expect(buttons).toHaveLength(2);
    const selectors = buttons.map((b) => b.selector);
    expect(new Set(selectors).size).toBe(2);
    expect(
      selectors.map((s) => doc.querySelector(s)?.textContent?.trim()),
    ).toEqual(['first', 'second']);
  });
});

describe('captureBrowserSnapshot — performance metrics', () => {
  it('returns empty perf metrics when no navigation entry is available', async () => {
    const doc = freshDoc('<h1>Hi</h1>');
    const snap = await captureBrowserSnapshot({ document: doc, scanId: 's' });
    // happy-dom exposes performance.getEntriesByType but yields no navigation
    // entry, so the collector returns an empty record rather than throwing.
    expect(snap.perfMetrics).toEqual({});
  });
});

describe('captureBrowserSnapshot — timings invariants', () => {
  it('reports non-negative dom, ax and total timings', async () => {
    const doc = freshDoc('<h1>Hi</h1><button>Go</button>');
    const snap = await captureBrowserSnapshot({ document: doc, scanId: 's' });
    expect(snap.timings.navigationMs).toBe(0);
    expect(snap.timings.domMs).toBeGreaterThanOrEqual(0);
    expect(snap.timings.axTreeMs).toBeGreaterThanOrEqual(0);
    expect(snap.timings.totalMs).toBeGreaterThanOrEqual(0);
  });

  it('records axTreeMs of effectively zero work when no debugger is supplied', async () => {
    const doc = freshDoc('<h1>Hi</h1>');
    const snap = await captureBrowserSnapshot({ document: doc, scanId: 's' });
    expect(snap.axTree).toEqual([]);
    expect(snap.timings.axTreeMs).toBeGreaterThanOrEqual(0);
  });
});

describe('captureBrowserSnapshot — debugger edge cases', () => {
  it('returns an empty axTree when the debugger sendCommand returns a non-array payload', async () => {
    const doc = freshDoc('<h1>Hi</h1>');
    const snap = await captureBrowserSnapshot({
      document: doc,
      scanId: 's',
      axDebugger: {
        tabId: 7,
        debugger: {
          async attach() {
            /* ok */
          },
          async detach() {
            /* ok */
          },
          async sendCommand() {
            return {} as { nodes?: unknown[] };
          },
        },
      },
    });
    expect(snap.axTree).toEqual([]);
  });

  it('returns an empty axTree when sendCommand throws but still detaches', async () => {
    const doc = freshDoc('<h1>Hi</h1>');
    const calls: string[] = [];
    const snap = await captureBrowserSnapshot({
      document: doc,
      scanId: 's',
      axDebugger: {
        tabId: 9,
        debugger: {
          async attach(t) {
            calls.push(`attach:${t.tabId}`);
          },
          async detach(t) {
            calls.push(`detach:${t.tabId}`);
          },
          async sendCommand() {
            throw new Error('protocol error');
          },
        },
      },
    });
    expect(snap.axTree).toEqual([]);
    expect(calls).toEqual(['attach:9', 'detach:9']);
  });
});
