// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import type { PropertySnapshot } from '@ariada-org/core-engine';

/**
 * Inputs the content script supplies when capturing the active tab. The page
 * context cannot read HTTP response headers or transport-security metadata, so
 * those snapshot fields are left empty here; a richer capturing surface (the
 * Playwright or CDP path) fills them in.
 */
export interface CaptureSnapshotOptions {
  readonly scanId: string;
  readonly url: string;
}

/**
 * Walk a live document into a {@link PropertySnapshot} the shared single-pass
 * walker can traverse. Each element becomes one outline entry carrying its
 * upper-cased node name, a unique CSS selector, and its full attribute map so
 * domain extractors (for example the accessibility alt-text check) can read it.
 *
 * This runs in the page's own JavaScript context — it never touches `chrome.*`
 * APIs — so it is safe to bundle into a content script.
 */
export function captureSnapshot(doc: Document, opts: CaptureSnapshotOptions): PropertySnapshot {
  const elements = Array.from(doc.querySelectorAll('*'));
  let backendNodeId = 0;

  const domOutline = elements.map((el) => {
    backendNodeId += 1;
    const attributes: Record<string, string> = {};
    for (const attr of Array.from(el.attributes)) {
      attributes[attr.name] = attr.value;
    }
    return {
      backendNodeId,
      nodeName: el.nodeName.toUpperCase(),
      selector: buildSelector(el),
      attributes,
    };
  });

  const html = doc.documentElement?.outerHTML ?? '';

  return {
    scanId: opts.scanId,
    url: opts.url,
    timestamp: Date.now(),
    html,
    headers: {},
    cookies: [],
    networkResources: [],
    axTree: [],
    domOutline,
    perfMetrics: {},
    timings: { navigationMs: 0, axTreeMs: 0, domMs: 0, totalMs: 0 },
  };
}

/**
 * Build a unique, stable CSS selector for an element by walking up to the root,
 * disambiguating siblings of the same tag with `:nth-of-type`. Preferring an
 * `id` when present keeps selectors short and readable.
 */
function buildSelector(el: Element): string {
  if (el.id) return `#${cssEscape(el.id)}`;

  const parts: string[] = [];
  let current: Element | null = el;
  while (current && current.nodeType === 1 && current.nodeName.toLowerCase() !== 'html') {
    const tag = current.nodeName.toLowerCase();
    const parent: Element | null = current.parentElement;
    if (!parent) {
      parts.unshift(tag);
      break;
    }
    const sameTagSiblings = Array.from(parent.children).filter(
      (c) => c.nodeName.toLowerCase() === tag,
    );
    if (sameTagSiblings.length > 1) {
      const index = sameTagSiblings.indexOf(current) + 1;
      parts.unshift(`${tag}:nth-of-type(${index})`);
    } else {
      parts.unshift(tag);
    }
    current = parent;
  }
  return parts.length > 0 ? parts.join(' > ') : el.nodeName.toLowerCase();
}

/** Minimal CSS identifier escape for ids that contain special characters. */
function cssEscape(value: string): string {
  return value.replace(/([^a-zA-Z0-9_-])/g, '\\$1');
}
