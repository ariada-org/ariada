// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
/**
 * Rule: ariada/ebooks/viewport-allows-zoom
 *
 * A reading surface (e-book reader, long-form article view, dedicated reading
 * software web shell) must not suppress browser zoom. The `<meta name="viewport">`
 * tag must NOT set `user-scalable=no` and must NOT cap `maximum-scale` below 2.
 * Both of those disable or limit pinch/keyboard magnification, which readers with
 * low vision rely on to size text up to at least 200%.
 *
 * WCAG SC: 1.4.4 Resize Text (Level AA).
 */

import type { CheckEvaluate, RuleDefinition, RuleMetadata } from '../../types.js';

const HELP_URL =
  'https://github.com/ariada-org/ariada/blob/main/packages/wcag-rules-extended/docs/rules/ebooks-viewport-allows-zoom.md';

export const metadata: RuleMetadata = {
  description: 'Viewport meta tag must not block or cap browser zoom below 200%.',
  help: 'Remove user-scalable=no and do not set maximum-scale below 2.',
  helpUrl: HELP_URL,
  wcag: ['1.4.4'],
  en301549: ['9.1.4.4'],
  eaaAnnexI: ['I.5'],
  impact: 'serious',
};

function isViewportMeta(node: Element): boolean {
  return (
    node.tagName.toLowerCase() === 'meta' &&
    (node.getAttribute('name') ?? '').trim().toLowerCase() === 'viewport'
  );
}

/**
 * Parse the comma-separated `content` of a viewport meta into a lookup of
 * lower-cased keys to trimmed values, e.g. "width=device-width, user-scalable=no"
 * becomes { 'width': 'device-width', 'user-scalable': 'no' }.
 */
function parseViewportContent(content: string): Map<string, string> {
  const directives = new Map<string, string>();
  for (const part of content.split(',')) {
    const [rawKey, rawValue] = part.split('=');
    if (rawKey === undefined || rawValue === undefined) continue;
    directives.set(rawKey.trim().toLowerCase(), rawValue.trim().toLowerCase());
  }
  return directives;
}

export const check: CheckEvaluate = (node) => {
  if (!isViewportMeta(node)) return true;
  const content = node.getAttribute('content');
  if (!content) return true;
  const directives = parseViewportContent(content);

  // user-scalable=no (or 0) disables magnification entirely.
  const userScalable = directives.get('user-scalable');
  if (userScalable === 'no' || userScalable === '0') return false;

  // maximum-scale below 2 caps zoom under the 200% WCAG 1.4.4 floor.
  const maximumScale = directives.get('maximum-scale');
  if (maximumScale !== undefined) {
    const value = Number.parseFloat(maximumScale);
    if (Number.isFinite(value) && value < 2) return false;
  }

  return true;
};

export const rule: RuleDefinition = {
  id: 'ariada/ebooks/viewport-allows-zoom',
  selector: 'meta[name="viewport"]',
  matches: isViewportMeta,
  any: ['ariada/ebooks/viewport-not-zoom-locked'],
  all: [],
  none: [],
  tags: ['cat.text', 'wcag2aa', 'wcag144', 'EAA', 'EAA-I5'],
  metadata,
};

export const checkDefinition = {
  id: 'ariada/ebooks/viewport-not-zoom-locked',
  evaluate: check,
  metadata: {
    impact: metadata.impact,
    messages: {
      pass: 'Viewport meta tag allows zoom up to at least 200%.',
      fail: 'Viewport meta tag blocks zoom (user-scalable=no or maximum-scale below 2).',
    },
  },
};
