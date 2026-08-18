// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { buildElementSelector, FINDING_ELEMENTS } from '@ariada-org/core-engine';
import type { AXNode, BackendNodeId, Finding, UnifiedSnapshot } from '@ariada-org/core-engine';
import type { Page } from 'playwright';

import { computeContrastFindings } from './contrast.js';

/**
 * Single-pass UnifiedSnapshot capture. One navigation; AXTree, DOM outline,
 * perf metrics, network resources captured in parallel.
 */
export interface SnapshotOptions {
  scanId: string;
  url: string;
  screenshot?: boolean;
  /**
   * Optional hook that runs the full rule library (axe-core) against the live
   * page and returns mapped findings. Injected by the scanner so this package
   * does not take a hard dependency on the rule-library package. When absent or
   * when it throws, capture proceeds with no library findings.
   */
  runAxe?: (page: Page) => Promise<Finding[]>;
  /**
   * Run the computed-style contrast pass (SC 1.4.3) after the snapshot is
   * assembled and merge its definite violations into `axeFindings`. Default on;
   * set `false` to skip (e.g. unit snapshots with no real page styles).
   */
  contrast?: boolean;
}

/**
 *
 */
export async function captureSnapshot(
  page: Page,
  opts: SnapshotOptions,
): Promise<UnifiedSnapshot> {
  const t0 = Date.now();

  const [axResult, domResult, perfResult, shotResult, htmlResult, cookiesResult, axeResult] =
    await Promise.allSettled([
      captureAxTree(page),
      captureDomOutline(page),
      capturePerf(page),
      opts.screenshot === false ? Promise.resolve(undefined) : captureScreenshot(page),
      captureHtml(page),
      captureCookies(page),
      opts.runAxe ? opts.runAxe(page) : Promise.resolve<Finding[]>([]),
    ]);

  const timings: UnifiedSnapshot['timings'] = {
    navigationMs: 0,
    axTreeMs: axResult.status === 'fulfilled' ? axResult.value.elapsedMs : 0,
    domMs: domResult.status === 'fulfilled' ? domResult.value.elapsedMs : 0,
    totalMs: Date.now() - t0,
  };

  const html = htmlResult.status === 'fulfilled' ? htmlResult.value : '';
  const cookies = cookiesResult.status === 'fulfilled' ? cookiesResult.value : [];
  const axeFindings = axeResult.status === 'fulfilled' ? axeResult.value : [];

  const snap: UnifiedSnapshot = {
    scanId: opts.scanId,
    url: opts.url,
    timestamp: Date.now(),
    axTree: axResult.status === 'fulfilled' ? axResult.value.nodes : [],
    domOutline: domResult.status === 'fulfilled' ? domResult.value.nodes : [],
    perfMetrics: perfResult.status === 'fulfilled' ? perfResult.value : {},
    networkResources: [],
    timings,
    html,
    cookies,
    ...(axeFindings.length > 0 ? { axeFindings } : {}),
    ...(shotResult.status === 'fulfilled' && shotResult.value
      ? { screenshot: shotResult.value }
      : {}),
  };

  // Contrast pass (SC 1.4.3): the assembled snapshot now has the DOM outline, so
  // enrich its AX tree with live computed colours and run the bundled analyzer.
  // Merged into axeFindings so it flows to the report exactly like the rule
  // library's output. Never throws (returns [] on failure).
  if (opts.contrast !== false) {
    const contrastFindings = await computeContrastFindings(snap, page);
    if (contrastFindings.length > 0) {
      snap.axeFindings = [...(snap.axeFindings ?? []), ...contrastFindings];
    }
  }

  return snap;
}

/** Capture the fully-rendered HTML of the page's main frame. */
async function captureHtml(page: Page): Promise<string> {
  try {
    return await page.content();
  } catch {
    return '';
  }
}

/** Capture cookies visible to the page's browser context. */
async function captureCookies(page: Page): Promise<NonNullable<UnifiedSnapshot['cookies']>> {
  try {
    const raw = await page.context().cookies();
    return raw.map((c) => ({
      name: c.name,
      value: c.value,
      domain: c.domain,
      path: c.path,
      expires: c.expires,
      httpOnly: c.httpOnly,
      secure: c.secure,
      ...(c.sameSite ? { sameSite: c.sameSite } : {}),
    }));
  } catch {
    return [];
  }
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
  attributes?: Record<string, string>;
}

async function captureDomOutline(
  page: Page,
): Promise<{ nodes: DomOutlineNode[]; elapsedMs: number }> {
  const t0 = Date.now();
  const nodes: DomOutlineNode[] = [];

  let backendIdCounter = 1;
  for (const frame of page.frames()) {
    try {
      const handles = await frame.$$(FINDING_ELEMENTS);
      for (const handle of handles) {
        const meta = await handle
          .evaluate((el) => {
            const attributes: Record<string, string> = {};
            for (const name of el.getAttributeNames()) {
              attributes[name] = el.getAttribute(name) ?? '';
            }
            return { nodeName: el.tagName.toLowerCase(), attributes };
          })
          .catch(() => undefined);

        // The name is built by the shared function, handed to the page as
        // itself rather than rebuilt from a string, so a page with a strict
        // content-security policy is scanned like any other.
        const selector = await frame
          .evaluate(buildElementSelector, handle)
          .catch(() => undefined);

        if (!meta || !selector) continue;

        const frameUrl = frame.url();
        nodes.push({
          backendNodeId: backendIdCounter++,
          nodeName: meta.nodeName,
          selector,
          ...(frameUrl !== page.url() ? { frameId: frameUrl } : {}),
          ...(Object.keys(meta.attributes).length > 0 ? { attributes: meta.attributes } : {}),
        });
        await handle.dispose().catch(() => undefined);
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
