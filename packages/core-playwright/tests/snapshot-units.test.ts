// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import type { Page } from 'playwright';
import { describe, expect, it } from 'vitest';

import { captureSnapshot } from '../src/snapshot.js';

interface ElementSpec {
  tagName: string;
  attributes?: Record<string, string>;
}

interface FrameSpec {
  url: string;
  elements: ElementSpec[];
}

interface PageSpec {
  pageUrl: string;
  frames: FrameSpec[];
  axNodes?: unknown[];
  axThrows?: boolean;
  perf?: Record<string, number> | (() => never);
  screenshot?: Uint8Array | (() => never);
}

function makeElementHandle(spec: ElementSpec): unknown {
  const attrs = spec.attributes ?? {};
  return {
    async evaluate<T>(fn: (el: unknown, idx: number) => T, idx: number): Promise<T> {
      const el = {
        tagName: spec.tagName,
        getAttribute: (name: string): string | null => attrs[name] ?? null,
        getAttributeNames: (): string[] => Object.keys(attrs),
      } as unknown;
      return fn(el, idx);
    },
    async dispose(): Promise<void> {
      // noop
    },
  };
}

function makeFrame(spec: FrameSpec): unknown {
  return {
    url: (): string => spec.url,
    async $$(_: string): Promise<unknown[]> {
      return spec.elements.map(makeElementHandle);
    },
  };
}

function makePage(spec: PageSpec): Page {
  const frames = spec.frames.map(makeFrame);
  const fake = {
    url: (): string => spec.pageUrl,
    frames(): unknown[] {
      return frames;
    },
    context(): { newCDPSession: () => Promise<unknown> } {
      return {
        newCDPSession: async (): Promise<unknown> => {
          if (spec.axThrows) throw new Error('no cdp');
          return {
            async send(method: string): Promise<{ nodes?: unknown[] }> {
              if (method === 'Accessibility.getFullAXTree') {
                return { nodes: spec.axNodes ?? [] };
              }
              return {};
            },
            async detach(): Promise<void> {
              // noop
            },
          };
        },
      };
    },
    async evaluate(): Promise<Record<string, number>> {
      if (typeof spec.perf === 'function') return spec.perf();
      return spec.perf ?? {};
    },
    async screenshot(): Promise<Uint8Array> {
      if (typeof spec.screenshot === 'function') return spec.screenshot();
      return spec.screenshot ?? new Uint8Array([137, 80, 78, 71]);
    },
  };
  return fake as unknown as Page;
}

describe('captureSnapshot — AX tree', () => {
  it('collects AX nodes returned by the CDP session', async () => {
    const page = makePage({
      pageUrl: 'http://test/',
      frames: [{ url: 'http://test/', elements: [] }],
      axNodes: [
        { nodeId: '1', role: { type: 'role', value: 'WebArea' } },
        { nodeId: '2', role: { type: 'role', value: 'heading' } },
      ],
    });
    const snap = await captureSnapshot(page, { scanId: 's', url: 'http://test/' });
    expect(snap.axTree).toHaveLength(2);
    expect(snap.axTree[0]?.nodeId).toBe('1');
  });

  it('yields an empty AX tree when CDP session creation throws', async () => {
    const page = makePage({
      pageUrl: 'http://test/',
      frames: [{ url: 'http://test/', elements: [] }],
      axThrows: true,
    });
    const snap = await captureSnapshot(page, { scanId: 's', url: 'http://test/' });
    expect(snap.axTree).toEqual([]);
  });

  it('tolerates an absent nodes payload from CDP', async () => {
    const page = makePage({
      pageUrl: 'http://test/',
      frames: [{ url: 'http://test/', elements: [] }],
    });
    const snap = await captureSnapshot(page, { scanId: 's', url: 'http://test/' });
    expect(snap.axTree).toEqual([]);
  });
});

describe('captureSnapshot — DOM outline selectors', () => {
  it('prefers an id-based selector when the element has an id', async () => {
    const page = makePage({
      pageUrl: 'http://test/',
      frames: [
        { url: 'http://test/', elements: [{ tagName: 'H1', attributes: { id: 'title' } }] },
      ],
    });
    const snap = await captureSnapshot(page, { scanId: 's', url: 'http://test/' });
    const node = snap.domOutline.find((n) => n.nodeName === 'h1');
    expect(node?.selector).toBe('h1#title');
  });

  it('falls back to the first class when no id is present', async () => {
    const page = makePage({
      pageUrl: 'http://test/',
      frames: [
        {
          url: 'http://test/',
          elements: [{ tagName: 'BUTTON', attributes: { class: 'primary big' } }],
        },
      ],
    });
    const snap = await captureSnapshot(page, { scanId: 's', url: 'http://test/' });
    const node = snap.domOutline.find((n) => n.nodeName === 'button');
    expect(node?.selector).toBe('button.primary');
  });

  it('falls back to nth-of-type when neither id nor class is present', async () => {
    const page = makePage({
      pageUrl: 'http://test/',
      frames: [{ url: 'http://test/', elements: [{ tagName: 'P' }] }],
    });
    const snap = await captureSnapshot(page, { scanId: 's', url: 'http://test/' });
    const node = snap.domOutline.find((n) => n.nodeName === 'p');
    expect(node?.selector).toBe('p:nth-of-type(1)');
  });

  it('assigns sequential backendNodeId values across the outline', async () => {
    const page = makePage({
      pageUrl: 'http://test/',
      frames: [
        {
          url: 'http://test/',
          elements: [{ tagName: 'H1' }, { tagName: 'P' }, { tagName: 'A' }],
        },
      ],
    });
    const snap = await captureSnapshot(page, { scanId: 's', url: 'http://test/' });
    expect(snap.domOutline.map((n) => n.backendNodeId)).toEqual([1, 2, 3]);
  });

  it('tags elements in a child frame with the frame url as frameId', async () => {
    const page = makePage({
      pageUrl: 'http://test/',
      frames: [
        { url: 'http://test/', elements: [{ tagName: 'H1' }] },
        { url: 'http://test/iframe/', elements: [{ tagName: 'P' }] },
      ],
    });
    const snap = await captureSnapshot(page, { scanId: 's', url: 'http://test/' });
    const mainNode = snap.domOutline.find((n) => n.nodeName === 'h1');
    const childNode = snap.domOutline.find((n) => n.nodeName === 'p');
    expect(mainNode?.frameId).toBeUndefined();
    expect(childNode?.frameId).toBe('http://test/iframe/');
  });
});

describe('captureSnapshot — metrics and resilience', () => {
  it('passes through navigation perf metrics from page.evaluate', async () => {
    const page = makePage({
      pageUrl: 'http://test/',
      frames: [{ url: 'http://test/', elements: [] }],
      perf: { domContentLoaded: 12, loadEvent: 34 },
    });
    const snap = await captureSnapshot(page, { scanId: 's', url: 'http://test/' });
    expect(snap.perfMetrics).toEqual({ domContentLoaded: 12, loadEvent: 34 });
  });

  it('yields empty perf metrics when page.evaluate throws', async () => {
    const page = makePage({
      pageUrl: 'http://test/',
      frames: [{ url: 'http://test/', elements: [] }],
      perf: () => {
        throw new Error('eval blocked');
      },
    });
    const snap = await captureSnapshot(page, { scanId: 's', url: 'http://test/' });
    expect(snap.perfMetrics).toEqual({});
  });

  it('omits the screenshot when capture throws', async () => {
    const page = makePage({
      pageUrl: 'http://test/',
      frames: [{ url: 'http://test/', elements: [] }],
      screenshot: () => {
        throw new Error('screenshot failed');
      },
    });
    const snap = await captureSnapshot(page, { scanId: 's', url: 'http://test/' });
    expect(snap.screenshot).toBeUndefined();
  });

  it('always starts with empty networkResources', async () => {
    const page = makePage({
      pageUrl: 'http://test/',
      frames: [{ url: 'http://test/', elements: [] }],
    });
    const snap = await captureSnapshot(page, { scanId: 's', url: 'http://test/' });
    expect(snap.networkResources).toEqual([]);
  });

  it('echoes scanId and url onto the snapshot and records a timestamp', async () => {
    const page = makePage({
      pageUrl: 'http://test/',
      frames: [{ url: 'http://test/', elements: [] }],
    });
    const before = Date.now();
    const snap = await captureSnapshot(page, { scanId: 'scan-42', url: 'http://example/' });
    expect(snap.scanId).toBe('scan-42');
    expect(snap.url).toBe('http://example/');
    expect(snap.timestamp).toBeGreaterThanOrEqual(before);
    expect(snap.timings.navigationMs).toBe(0);
    expect(snap.timings.totalMs).toBeGreaterThanOrEqual(0);
  });
});
