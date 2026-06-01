// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
/**
 * Rule: ariada/ebooks/no-positive-tabindex-in-reading
 *
 * Inside a reading surface the keyboard focus order should follow the natural
 * reading sequence (the DOM order). A positive `tabindex` (> 0) yanks an
 * element to the front of the tab cycle regardless of where it sits in the
 * text, scrambling the order in which a keyboard or screen-reader user reaches
 * footnotes, links, and controls. Use `tabindex="0"` or a negative value
 * instead.
 *
 * WCAG SC: 2.4.3 Focus Order (Level A), 1.3.2 Meaningful Sequence (Level A).
 */

import type { CheckEvaluate, RuleDefinition, RuleMetadata } from '../../types.js';

const HELP_URL =
  'https://github.com/ariada-org/ariada/blob/main/packages/wcag-rules-extended/docs/rules/ebooks-no-positive-tabindex-in-reading.md';

export const metadata: RuleMetadata = {
  description: 'Reading regions must not contain elements with a positive tabindex.',
  help: 'Use tabindex="0" or a negative value so focus follows reading order.',
  helpUrl: HELP_URL,
  wcag: ['2.4.3', '1.3.2'],
  en301549: ['9.2.4.3', '9.1.3.2'],
  eaaAnnexI: ['I.5'],
  impact: 'moderate',
};

const READING_ROOT_SELECTOR =
  'article, [role="document"], [role="article"], [data-reading-content]';

function looksLikeReadingFocusable(node: Element): boolean {
  if (!node.hasAttribute('tabindex')) return false;
  return node.closest(READING_ROOT_SELECTOR) !== null;
}

export const check: CheckEvaluate = (node) => {
  if (!looksLikeReadingFocusable(node)) return true;
  const raw = node.getAttribute('tabindex') ?? '';
  const value = Number.parseInt(raw, 10);
  // A non-numeric tabindex proves no forced ordering — pass.
  if (Number.isNaN(value)) return true;
  return value <= 0;
};

export const rule: RuleDefinition = {
  id: 'ariada/ebooks/no-positive-tabindex-in-reading',
  selector:
    'article [tabindex], [role="document"] [tabindex], [role="article"] [tabindex], [data-reading-content] [tabindex]',
  matches: looksLikeReadingFocusable,
  any: ['ariada/ebooks/reading-tabindex-not-positive'],
  all: [],
  none: [],
  tags: ['cat.keyboard', 'wcag2a', 'wcag243', 'wcag132', 'EAA', 'EAA-I5'],
  metadata,
};

export const checkDefinition = {
  id: 'ariada/ebooks/reading-tabindex-not-positive',
  evaluate: check,
  metadata: {
    impact: metadata.impact,
    messages: {
      pass: 'Reading-region focusable elements use a non-positive tabindex.',
      fail: 'A positive tabindex breaks the natural reading focus order.',
    },
  },
};
