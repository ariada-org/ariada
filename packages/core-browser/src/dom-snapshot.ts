// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import type { AXNode, BackendNodeId, UnifiedSnapshot } from '@ariada-org/core-engine';

/**
 * Optional `chrome.debugger`-shaped handle for extension-context callers that
 * want to pull the full AX tree from the inspected page. We intentionally
 * type this loosely so we don't depend on `@types/chrome` here — the Chrome
 * extension can pass its own typed wrapper.
 */
export interface ChromeDebugger {
  attach(target: { tabId: number }, requiredVersion: string): Promise<void>;
  detach(target: { tabId: number }): Promise<void>;
  sendCommand(
    target: { tabId: number },
    method: 'Accessibility.getFullAXTree',
    params?: { depth?: number },
  ): Promise<{ nodes?: unknown[] }>;
}

/**
 *
 */
export interface DebuggerTarget {
  tabId: number;
  debugger: ChromeDebugger;
}

/**
 *
 */
export interface CaptureBrowserSnapshotOpts {
  document: Document;
  scanId: string;
  url?: string;
  axDebugger?: DebuggerTarget;
}

/**
 * Capture a `UnifiedSnapshot` from the live DOM. Designed for the Chrome
 * extension scanner — but works against any DOM-shaped object (happy-dom,
 * jsdom) so it can be unit-tested without a real browser.
 *
 */
export async function captureBrowserSnapshot(
  opts: CaptureBrowserSnapshotOpts,
): Promise<UnifiedSnapshot> {
  const t0 = now();
  const url = opts.url ?? opts.document.URL ?? '';

  const domStart = now();
  const domOutline = collectDomOutline(opts.document);
  const domMs = now() - domStart;

  const axStart = now();
  const axTree = opts.axDebugger ? await captureAxTreeViaDebugger(opts.axDebugger) : [];
  const axTreeMs = now() - axStart;

  const perfMetrics = collectPerfMetrics(opts.document);

  const snap: UnifiedSnapshot = {
    scanId: opts.scanId,
    url,
    timestamp: Date.now(),
    axTree,
    domOutline,
    perfMetrics,
    networkResources: [],
    timings: {
      navigationMs: 0,
      axTreeMs,
      domMs,
      totalMs: now() - t0,
    },
  };

  return snap;
}

interface DomOutlineNode {
  backendNodeId: BackendNodeId;
  nodeName: string;
  selector: string;
  frameId?: string;
}

const SELECTOR =
  'h1, h2, h3, h4, h5, h6, a, button, img, input, select, textarea, [role], [aria-label], p, li, label, [tabindex]';

function collectDomOutline(doc: Document): DomOutlineNode[] {
  const out: DomOutlineNode[] = [];
  let counter = 1;
  let queryAll: NodeListOf<Element> | Element[];
  try {
    queryAll = doc.querySelectorAll(SELECTOR);
  } catch {
    queryAll = [];
  }

  for (const el of Array.from(queryAll)) {
    const tag = el.tagName.toLowerCase();
    out.push({
      backendNodeId: counter++,
      nodeName: tag,
      selector: buildElementSelector(doc, el),
    });
  }
  return out;
}

function buildElementSelector(doc: Document, el: Element): string {
  const preferred = preferredSelectorPart(el);
  if (selectorResolvesTo(doc, preferred, el)) return preferred;

  const parts = [nthOfTypeSelectorPart(el)];
  let parent = el.parentElement;
  while (parent) {
    parts.unshift(nthOfTypeSelectorPart(parent));
    const candidate = parts.join(' > ');
    if (selectorResolvesTo(doc, candidate, el)) return candidate;
    parent = parent.parentElement;
  }

  return parts.join(' > ');
}

function preferredSelectorPart(el: Element): string {
  const tag = el.tagName.toLowerCase();
  const id = el.getAttribute('id');
  if (id) return `${tag}#${id}`;

  const cls = (el.getAttribute('class') ?? '').split(/\s+/).filter(Boolean)[0];
  if (cls) return `${tag}.${cls}`;

  return nthOfTypeSelectorPart(el);
}

function nthOfTypeSelectorPart(el: Element): string {
  const tag = el.tagName.toLowerCase();
  let position = 1;
  let sibling = el.previousElementSibling;
  while (sibling) {
    if (sibling.tagName === el.tagName) position++;
    sibling = sibling.previousElementSibling;
  }
  return `${tag}:nth-of-type(${position})`;
}

function selectorResolvesTo(doc: Document, selector: string, el: Element): boolean {
  try {
    return doc.querySelector(selector) === el && doc.querySelectorAll(selector).length === 1;
  } catch {
    return false;
  }
}

async function captureAxTreeViaDebugger(target: DebuggerTarget): Promise<AXNode[]> {
  try {
    await target.debugger.attach({ tabId: target.tabId }, '1.3');
  } catch {
    return [];
  }
  try {
    const result = await target.debugger.sendCommand(
      { tabId: target.tabId },
      'Accessibility.getFullAXTree',
      { depth: -1 },
    );
    if (Array.isArray(result.nodes)) {
      return result.nodes as AXNode[];
    }
    return [];
  } catch {
    return [];
  } finally {
    await target.debugger.detach({ tabId: target.tabId }).catch(() => undefined);
  }
}

function collectPerfMetrics(doc: Document): Record<string, number> {
  const out: Record<string, number> = {};
  // `performance` is a global on Window. happy-dom/jsdom expose a partial
  // implementation; tolerate either presence or absence cleanly.
  const perf =
    (doc.defaultView as { performance?: PerformanceLike } | null | undefined)?.performance ??
    (typeof globalThis !== 'undefined'
      ? (globalThis as unknown as { performance?: PerformanceLike }).performance
      : undefined);
  if (!perf || typeof perf.getEntriesByType !== 'function') return out;
  try {
    const entries = perf.getEntriesByType('navigation');
    const nav = entries[0];
    if (nav) {
      out['domContentLoaded'] = nav.domContentLoadedEventEnd - nav.startTime;
      out['loadEvent'] = nav.loadEventEnd - nav.startTime;
    }
  } catch {
    // ignore
  }
  return out;
}

interface PerformanceLike {
  getEntriesByType(
    type: string,
  ): Array<{ domContentLoadedEventEnd: number; loadEventEnd: number; startTime: number }>;
}

function now(): number {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
}
