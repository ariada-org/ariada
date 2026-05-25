// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { Window } from 'happy-dom';
import { describe, expect, it } from 'vitest';

import { captureBrowserSnapshot, type DebuggerTarget } from '../src/dom-snapshot.js';

function freshDoc(html: string): Document {
  const win = new Window({ url: 'http://test.local/' });
  win.document.write(html);
  return win.document as unknown as Document;
}

describe('captureBrowserSnapshot', () => {
  it('returns a well-formed UnifiedSnapshot from a live document', async () => {
    const doc = freshDoc(`
      <!doctype html>
      <html>
        <body>
          <h1 id="title">Hello</h1>
          <p>Body</p>
          <button>Action</button>
          <a href="#">Link</a>
          <img src="x.png">
          <input type="text">
        </body>
      </html>
    `);

    const snap = await captureBrowserSnapshot({ document: doc, scanId: 'scan-x' });
    expect(snap.scanId).toBe('scan-x');
    expect(snap.url).toBe('http://test.local/');
    expect(Array.isArray(snap.axTree)).toBe(true);
    expect(snap.axTree).toHaveLength(0); // no debugger supplied
    expect(snap.domOutline.length).toBeGreaterThan(0);
    const tags = snap.domOutline.map((n) => n.nodeName).sort();
    expect(tags).toContain('h1');
    expect(tags).toContain('button');
    expect(tags).toContain('img');
    expect(snap.timings.totalMs).toBeGreaterThanOrEqual(0);
  });

  it('builds id-based selectors when an element has @id', async () => {
    const doc = freshDoc('<h1 id="title">Hi</h1>');
    const snap = await captureBrowserSnapshot({ document: doc, scanId: 'scan-x' });
    const heading = snap.domOutline.find((n) => n.nodeName === 'h1');
    expect(heading?.selector).toBe('h1#title');
  });

  it('falls back to nth-of-type selectors when no id or class is present', async () => {
    const doc = freshDoc('<p>one</p><p>two</p>');
    const snap = await captureBrowserSnapshot({ document: doc, scanId: 'scan-x' });
    const paragraphs = snap.domOutline.filter((n) => n.nodeName === 'p');
    expect(paragraphs).toHaveLength(2);
    expect(paragraphs[0]?.selector).toBe('p:nth-of-type(1)');
    expect(paragraphs[1]?.selector).toBe('p:nth-of-type(2)');
  });

  it('builds selectors that resolve to the source element across repeated subtrees', async () => {
    const doc = freshDoc(`
      <main>
        <section><p>First section</p></section>
        <section><p>Second section</p></section>
      </main>
    `);
    const snap = await captureBrowserSnapshot({ document: doc, scanId: 'scan-x' });
    const paragraphs = snap.domOutline.filter((n) => n.nodeName === 'p');

    expect(paragraphs).toHaveLength(2);
    const selectors = paragraphs.map((n) => n.selector);
    expect(new Set(selectors).size).toBe(2);
    expect(selectors.map((selector) => doc.querySelector(selector)?.textContent?.trim())).toEqual([
      'First section',
      'Second section',
    ]);
  });

  it('honours the explicit url override', async () => {
    const doc = freshDoc('<p>x</p>');
    const snap = await captureBrowserSnapshot({
      document: doc,
      scanId: 'scan-x',
      url: 'https://override.example/',
    });
    expect(snap.url).toBe('https://override.example/');
  });

  it('pulls AXTree nodes through the supplied chrome.debugger shim', async () => {
    const doc = freshDoc('<h1>Hi</h1>');
    const calls: string[] = [];

    const target: DebuggerTarget = {
      tabId: 42,
      debugger: {
        async attach(t, version) {
          calls.push(`attach:${t.tabId}:${version}`);
        },
        async detach(t) {
          calls.push(`detach:${t.tabId}`);
        },
        async sendCommand(t, method, params) {
          calls.push(`send:${t.tabId}:${method}:${params?.depth ?? 'undef'}`);
          return {
            nodes: [
              { nodeId: '1', role: { type: 'role', value: 'WebArea' } },
              { nodeId: '2', role: { type: 'role', value: 'heading' } },
            ],
          };
        },
      },
    };

    const snap = await captureBrowserSnapshot({
      document: doc,
      scanId: 'scan-y',
      axDebugger: target,
    });
    expect(snap.axTree).toHaveLength(2);
    expect(snap.axTree[0]?.nodeId).toBe('1');
    expect(calls).toEqual([
      'attach:42:1.3',
      'send:42:Accessibility.getFullAXTree:-1',
      'detach:42',
    ]);
  });

  it('returns an empty axTree when chrome.debugger.attach throws', async () => {
    const doc = freshDoc('<h1>Hi</h1>');
    const target: DebuggerTarget = {
      tabId: 1,
      debugger: {
        async attach() {
          throw new Error('permission denied');
        },
        async detach() {
          /* noop */
        },
        async sendCommand() {
          return { nodes: [] };
        },
      },
    };

    const snap = await captureBrowserSnapshot({
      document: doc,
      scanId: 'scan-z',
      axDebugger: target,
    });
    expect(snap.axTree).toEqual([]);
  });
});
