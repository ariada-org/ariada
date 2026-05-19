// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
/**
 * Rule: ariada/statement/skip-link-from-every-page
 *
 * Every page (selector `html`) MUST have a skip-link to main content as
 * the first focusable item. While not strictly required by EAA / DOS-lagen,
 * the EAA guidance recommends it for cognitive accessibility, and WCAG 2.4.1
 * requires a bypass mechanism for repeated content.
 *
 * This rule is included in the statement pack because skip-link
 * implementation is commonly audited alongside accessibility statements.
 *
 * WCAG SC: 2.4.1 Bypass Blocks (Level A).
 * EN 301 549 v3.2.1: 9.2.4.1.
 */

import type { CheckEvaluate, RuleDefinition, RuleMetadata } from '../../types.js';

const HELP_URL =
  'https://github.com/ariada-org/ariada/blob/main/packages/wcag-rules-extended/docs/rules/statement-skip-link.md';

export const metadata: RuleMetadata = {
  description: 'Every page must have a skip-link to main content.',
  help: 'Add <a href="#main" class="skip-link">Skip to main content</a> as the first body element.',
  helpUrl: HELP_URL,
  wcag: ['2.4.1'],
  en301549: ['9.2.4.1'],
  eaaAnnexI: ['I.1'],
  impact: 'moderate',
};

const SKIP_TEXT_RE =
  /\b(skip\s+to\s+(main|content)|skip\s+navigation|hoppa\s+till|gå\s+til\s+(innhold|hovedinnhold)|spring\s+over|siirry\s+(sisältöön|p[aä][aä]sis[aä]lt[oö][oö]n))\b/i;

function isSkipLinkCandidate(a: Element): boolean {
  if (a.tagName.toLowerCase() !== 'a') return false;
  const href = a.getAttribute('href') ?? '';
  if (!href.startsWith('#')) return false;
  const text = (a.textContent ?? '').trim();
  return SKIP_TEXT_RE.test(text);
}

export const check: CheckEvaluate = (node) => {
  const doc = node.ownerDocument;
  const anchors = doc.querySelectorAll('a[href^="#"]');
  for (const a of Array.from(anchors)) {
    if (isSkipLinkCandidate(a)) return true;
  }
  return false;
};

export const rule: RuleDefinition = {
  id: 'ariada/statement/skip-link-from-every-page',
  selector: 'html',
  any: ['ariada/statement/has-skip-link'],
  all: [],
  none: [],
  tags: ['cat.keyboard', 'wcag2a', 'wcag241', 'EAA', 'EAA-I1'],
  metadata,
};

export const checkDefinition = {
  id: 'ariada/statement/has-skip-link',
  evaluate: check,
  metadata: {
    impact: metadata.impact,
    messages: {
      pass: 'Page has a skip-to-content link.',
      fail: 'Page is missing a skip-to-content link (WCAG 2.4.1).',
    },
  },
};
