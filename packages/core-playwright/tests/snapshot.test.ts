// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { Window } from 'happy-dom';
import type { Page } from 'playwright';
import { describe, expect, it } from 'vitest';

import { captureSnapshot } from '../src/snapshot.js';

function fakePage(): Page {
  // A real heading in a real document: naming it has to go through the naming
  // function, which is the thing under test here as much as the capture is.
  const window = new Window({ url: 'http://test/' });
  const doc = window.document as unknown as Document;
  doc.body.innerHTML = '<h1>Title</h1>';
  const heading = doc.body.firstElementChild as Element;

  const handle = {
    async evaluate<T>(fn: (el: Element) => T): Promise<T> {
      return fn(heading);
    },
    async dispose(): Promise<void> {
      // noop
    },
  };

  const frame = {
    url: (): string => 'http://test/',
    page: () => fake,
    async $$(_: string): Promise<unknown[]> {
      return [handle];
    },
    async evaluate<T>(fn: (el: Element) => T): Promise<T> {
      return fn(heading);
    },
  };

  const fake = {
    context(): { newCDPSession: () => Promise<never> } {
      return {
        newCDPSession: (): Promise<never> => Promise.reject(new Error('no cdp in test')),
      };
    },
    frames(): unknown[] {
      return [frame];
    },
    accessibility: {
      async snapshot(): Promise<null> {
        return null;
      },
    },
    url(): string {
      return 'http://test/';
    },
    async evaluate(): Promise<Record<string, number>> {
      return { domContentLoaded: 1, loadEvent: 2 };
    },
    async screenshot(): Promise<Uint8Array> {
      return new Uint8Array([137, 80, 78, 71]);
    },
  };

  return fake as unknown as Page;
}

describe('captureSnapshot', () => {
  it('returns a well-formed UnifiedSnapshot even when AX capture fails', async () => {
    const snap = await captureSnapshot(fakePage(), {
      scanId: 'scan-x',
      url: 'http://test/',
    });
    expect(snap.scanId).toBe('scan-x');
    expect(snap.url).toBe('http://test/');
    expect(Array.isArray(snap.axTree)).toBe(true);
    expect(Array.isArray(snap.domOutline)).toBe(true);
    expect(snap.domOutline.length).toBeGreaterThan(0);
    expect(snap.timings.totalMs).toBeGreaterThanOrEqual(0);
    expect(snap.screenshot).toBeInstanceOf(Uint8Array);
  });

  it('honours screenshot=false', async () => {
    const snap = await captureSnapshot(fakePage(), {
      scanId: 'scan-x',
      url: 'http://test/',
      screenshot: false,
    });
    expect(snap.screenshot).toBeUndefined();
  });
});
