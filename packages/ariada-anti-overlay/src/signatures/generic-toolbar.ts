// SPDX-License-Identifier: EUPL-1.2
/**
 * Generic accessibility-toolbar catch-all heuristic.
 *
 * Looks for an ARIA-labelled region whose label contains the word
 * "accessibility" AND that contains at least five of the canonical
 * toolbar-control keywords ({@link TOOLBAR_KEYWORDS}). Confidence is
 * ALWAYS locked to `low` (see the vendor `confidenceCap` below) — this signature is
 * deliberately broad to surface as-yet-unknown vendors without
 * over-claiming. Plain a11y settings panes with only one or two
 * controls do NOT trigger.
 *
 * Detection here is a two-pass scan: (1) find a region with the
 * accessibility ARIA-label; (2) within the same region's local
 * sub-string (the next 4 kB after the opening tag, capped) count
 * keyword hits. The cap is mechanical — it bounds work in a single
 * linear pass and prevents O(n²) cross-region matching.
 */

import type { VendorSignature } from '../types.js';

/**
 * Canonical toolbar-control keywords. Order chosen so the most
 * common controls (font-size, contrast) appear first — short-circuit
 * scans typically need only the first five hits.
 */
export const TOOLBAR_KEYWORDS: readonly string[] = [
  'font-size',
  'contrast',
  'links',
  'cursor',
  'reading mask',
  'dyslexia',
  'epilepsy',
  'voice',
];

/**
 * Custom matcher pattern. The orchestrator detects via standard regex
 * matching, but this signature carries a sentinel marker that the
 * matcher recognises. To keep the signature schema uniform, we use a
 * regex that matches the ARIA-label, and the post-match keyword count
 * is computed in detect.ts as a special-case. The matched value
 * returned is the literal label string.
 */
const ARIA_LABEL_REGEX =
  /<[^>]+role=["']region["'][^>]+aria-label=["']([^"']*accessibility[^"']*)["']/i;

const genericToolbar: VendorSignature = {
  id: 'generic-toolbar',
  displayName: 'Generic accessibility-toolbar (catch-all)',
  firstSeen: '2026-05-20',
  lastVerified: '2026-05-20',
  confidenceCap: 'low',
  signatures: [
    {
      kind: 'attribute',
      pattern: ARIA_LABEL_REGEX,
      locationHint: 'body *[role="region"][aria-label*="accessibility"]',
      label: 'role=region + aria-label*="accessibility" + ≥5 toolbar keywords',
    },
  ],
};

/**
 * Specialised matcher for the generic-toolbar heuristic. Returns
 * true when the input HTML contains an accessibility ARIA-labelled
 * region AND that region (or surrounding 4 kB) contains at least
 * `MIN_KEYWORDS` of the {@link TOOLBAR_KEYWORDS}.
 */
export const MIN_KEYWORDS = 5;
const REGION_WINDOW = 4096;

/**
 *
 */
export function matchesGenericToolbar(html: string): boolean {
  const m = ARIA_LABEL_REGEX.exec(html);
  if (m === null) return false;
  const startIdx = m.index;
  const window = html.slice(startIdx, startIdx + REGION_WINDOW).toLowerCase();
  let hits = 0;
  for (const kw of TOOLBAR_KEYWORDS) {
    if (window.includes(kw)) {
      hits += 1;
      if (hits >= MIN_KEYWORDS) return true;
    }
  }
  return false;
}

export default genericToolbar;
