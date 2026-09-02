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
    cookies: readCookies(doc),
    networkResources: readLoadedResources(doc),
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

/**
 * Cookies the page can see.
 *
 * These two fields used to be sent as empty arrays, which left the privacy
 * domain with nothing to judge: its two central rules — a cookie set before
 * consent, and a tracker contacted before consent — read exactly these. The
 * domain ran on every scan and could not report anything, so a page carrying
 * an analytics script and a tracking pixel came back clean.
 *
 * `document.cookie` withholds cookies marked HttpOnly, so what is returned is
 * the set a script placed — which is the set those rules are about. Cookies a
 * server sets with that flag are outside what a page can observe, and the
 * command-line tool, which drives a real browser session, sees them instead.
 */
function readCookies(doc: Document): Array<{ name: string; value: string }> {
  const raw = doc.cookie;
  if (!raw) return [];
  const out: Array<{ name: string; value: string }> = [];
  for (const pair of raw.split(';')) {
    const eq = pair.indexOf('=');
    if (eq <= 0) continue;
    const name = pair.slice(0, eq).trim();
    if (name) out.push({ name, value: pair.slice(eq + 1).trim() });
  }
  return out;
}

/**
 * Every subresource the page actually loaded, as the browser recorded it.
 *
 * The performance timeline holds the address of each script, image, stylesheet
 * and fetch the document made, which is what the tracker rules match against.
 * Transfer size is reported where the response allowed it; a cross-origin
 * response without the timing-allow header reports zero, so the size is
 * omitted rather than recorded as nothing.
 */
function readLoadedResources(doc: Document): Array<{ url: string; size?: number }> {
  const view = doc.defaultView;
  const timeline = view?.performance;
  if (!timeline?.getEntriesByType) return [];
  const out: Array<{ url: string; size?: number }> = [];
  for (const entry of timeline.getEntriesByType('resource')) {
    const url = entry.name;
    if (!url) continue;
    const size = (entry as PerformanceResourceTiming).transferSize;
    out.push(typeof size === 'number' && size > 0 ? { url, size } : { url });
  }
  return out;
}

/**
 * Fetch the files that live at the root of the site being scanned.
 *
 * The AI-readiness rules decide whether a site has a `robots.txt` and an
 * `llms.txt` — and nothing ever fetched them. The field they read was left
 * unset by every caller, so the absent-file branch was taken on every scan and
 * every site was told it had neither. GitHub, whose `robots.txt` is over two
 * kilobytes, was told it had none.
 *
 * A page may request its own origin, so this needs no extra permission beyond
 * the access already granted for the scan. A file that is missing, forbidden or
 * slow to answer yields an empty string, which is the same signal the rules
 * were getting before — but now it means the file was looked for and not found,
 * rather than never looked for.
 */
export async function fetchOriginArtifacts(
  url: string,
  timeoutMs = 4000,
): Promise<{ robotsTxt: string; llmsTxt: string }> {
  const read = async (path: string): Promise<string> => {
    let origin: string;
    try {
      origin = new URL(url).origin;
    } catch {
      return '';
    }
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), timeoutMs);
    try {
      const response = await fetch(`${origin}${path}`, {
        signal: abort.signal,
        credentials: 'omit',
        redirect: 'follow',
      });
      if (!response.ok) return '';
      // A site that serves its front page for any unknown path would otherwise
      // have its HTML read as a robots file.
      const type = response.headers.get('content-type') ?? '';
      if (type.includes('html')) return '';
      return await response.text();
    } catch {
      return '';
    } finally {
      clearTimeout(timer);
    }
  };

  const [robotsTxt, llmsTxt] = await Promise.all([read('/robots.txt'), read('/llms.txt')]);
  return { robotsTxt, llmsTxt };
}
