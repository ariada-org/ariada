// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import type { AXNode, BackendNodeId, UnifiedSnapshot } from '@ariada-org/core-engine';
import type { Page } from 'playwright';

/**
 * Single-pass UnifiedSnapshot capture. One navigation; AXTree, DOM outline,
 * perf metrics, network resources captured in parallel.
 */
export interface SnapshotOptions {
  scanId: string;
  url: string;
  screenshot?: boolean;
}

/**
 *
 */
export async function captureSnapshot(
  page: Page,
  opts: SnapshotOptions,
): Promise<UnifiedSnapshot> {
  const t0 = Date.now();

  const [axResult, domResult, perfResult, shotResult] = await Promise.allSettled([
    captureAxTree(page),
    captureDomOutline(page),
    capturePerf(page),
    opts.screenshot === false ? Promise.resolve(undefined) : captureScreenshot(page),
  ]);

  const timings: UnifiedSnapshot['timings'] = {
    navigationMs: 0,
    axTreeMs: axResult.status === 'fulfilled' ? axResult.value.elapsedMs : 0,
    domMs: domResult.status === 'fulfilled' ? domResult.value.elapsedMs : 0,
    totalMs: Date.now() - t0,
  };

  const snap: UnifiedSnapshot = {
    scanId: opts.scanId,
    url: opts.url,
    timestamp: Date.now(),
    axTree: axResult.status === 'fulfilled' ? axResult.value.nodes : [],
    domOutline: domResult.status === 'fulfilled' ? domResult.value.nodes : [],
    perfMetrics: perfResult.status === 'fulfilled' ? perfResult.value : {},
    networkResources: [],
    timings,
    ...(shotResult.status === 'fulfilled' && shotResult.value
      ? { screenshot: shotResult.value }
      : {}),
  };

  return snap;
}

async function captureAxTree(page: Page): Promise<{ nodes: AXNode[]; elapsedMs: number }> {
  const t0 = Date.now();
  const nodes: AXNode[] = [];

  for (const frame of page.frames()) {
    try {
      const session = await page.context().newCDPSession(frame as unknown as Page);
      try {
        const result = (await session.send('Accessibility.getFullAXTree', {
          depth: -1,
        })) as { nodes?: unknown[] };
        if (Array.isArray(result.nodes)) {
          for (const raw of result.nodes) {
            nodes.push(raw as AXNode);
          }
        }
      } finally {
        await session.detach().catch(() => undefined);
      }
    } catch {
      // Non-chromium browser or detached frame — skip AX capture for this frame.
      // Future: Playwright's page.accessibility.snapshot() fallback for Firefox/WebKit.
    }
  }

  return { nodes, elapsedMs: Date.now() - t0 };
}

interface DomOutlineNode {
  backendNodeId: BackendNodeId;
  nodeName: string;
  selector: string;
  frameId?: string;
}

async function captureDomOutline(
  page: Page,
): Promise<{ nodes: DomOutlineNode[]; elapsedMs: number }> {
  const t0 = Date.now();
  const nodes: DomOutlineNode[] = [];

  let backendIdCounter = 1;
  for (const frame of page.frames()) {
    try {
      const handles = await frame.$$(
        'h1, h2, h3, h4, h5, h6, a, button, img, input, select, textarea, [role], [aria-label], p, li, label, [tabindex]',
      );
      let index = 0;
      for (const handle of handles) {
        const meta = await handle
          .evaluate((el, idx: number) => {
            const tag = el.tagName.toLowerCase();
            let selector = tag;
            const id = el.getAttribute('id');
            if (id) selector = `${tag}#${id}`;
            else {
              const cls = (el.getAttribute('class') ?? '').split(/\s+/).filter(Boolean).slice(0, 1);
              if (cls.length > 0) selector = `${tag}.${cls[0]}`;
              else selector = `${tag}:nth-of-type(${idx + 1})`;
            }
            return { nodeName: tag, selector };
          }, index)
          .catch(() => undefined);

        if (!meta) {
          index++;
          continue;
        }

        const frameUrl = frame.url();
        nodes.push({
          backendNodeId: backendIdCounter++,
          nodeName: meta.nodeName,
          selector: meta.selector,
          ...(frameUrl !== page.url() ? { frameId: frameUrl } : {}),
        });
        await handle.dispose().catch(() => undefined);
        index++;
      }
    } catch {
      // skip frame
    }
  }

  return { nodes, elapsedMs: Date.now() - t0 };
}

async function capturePerf(page: Page): Promise<Record<string, number>> {
  try {
    const metrics = await page.evaluate(() => {
      const out: Record<string, number> = {};
      const entries = (performance as unknown as {
        getEntriesByType: (type: string) => Array<{
          domContentLoadedEventEnd: number;
          loadEventEnd: number;
          startTime: number;
        }>;
      }).getEntriesByType('navigation');
      const nav = entries[0];
      if (nav) {
        out['domContentLoaded'] = nav.domContentLoadedEventEnd - nav.startTime;
        out['loadEvent'] = nav.loadEventEnd - nav.startTime;
      }
      return out;
    });
    return metrics;
  } catch {
    return {};
  }
}

async function captureScreenshot(page: Page): Promise<Uint8Array | undefined> {
  try {
    const buf = await page.screenshot({ fullPage: false, type: 'png' });
    return new Uint8Array(buf);
  } catch {
    return undefined;
  }
}
