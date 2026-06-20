// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
/**
 * Rule: ariada/checkout/error-identification
 *
 * Error messages displayed in checkout forms MUST be programmatically
 * associated with the field that produced them (via `aria-describedby`
 * or `aria-errormessage`) AND announced via a live-region mechanism
 * (`role="alert"`, `aria-live="assertive"`, or `aria-live="polite"`).
 *
 * WCAG SC mapping:
 *   3.3.1 Error Identification (Level A)
 *   4.1.3 Status Messages (Level AA)
 *
 * EN 301 549 v3.2.1: 9.3.3.1, 9.4.1.3
 * EAA Annex I §I.3.
 *
 * @see ../../docs/rules/checkout-error-identification.md
 */

import { cssEscape } from '../../helpers.js';
import type { CheckEvaluate, RuleDefinition, RuleMetadata } from '../../types.js';

const HELP_URL =
  'https://github.com/ariada-org/ariada/blob/main/packages/wcag-rules-extended/docs/rules/checkout-error-identification.md';

export const metadata: RuleMetadata = {
  description:
    'Error messages must be programmatically associated with their fields and announced.',
  help: 'Use aria-errormessage or aria-describedby to link errors; add role=alert or aria-live.',
  helpUrl: HELP_URL,
  wcag: ['3.3.1', '4.1.3'],
  en301549: ['9.3.3.1', '9.4.1.3'],
  eaaAnnexI: ['I.3'],
  impact: 'serious',
};

/**
 * Heuristic: error message containers identified by class / role / id
 * conventions. Matches /error|invalid|fel|virhe|fout|erreur|fehler/i
 * (multilingual error tokens).
 */
function looksLikeErrorMessage(node: Element): boolean {
  const role = node.getAttribute('role');
  if (role === 'alert') return false; // Already correct — skip this rule
  const idAttribute = node.getAttribute('id') ?? '';
  const cls = node.getAttribute('class') ?? '';
  const combined = `${idAttribute} ${cls}`;
  return /error|invalid|fel|virhe|fout|erreur|fehler/i.test(combined);
}

export const check: CheckEvaluate = (node) => {
  if (!looksLikeErrorMessage(node)) return true;

  // Skip if element is empty (not currently in error state)
  if (!(node.textContent ?? '').trim()) return true;

  // Pass if has any live-region mechanism (self or ancestor)
  let current: Element | null = node;
  while (current) {
    const live = current.getAttribute('aria-live');
    if (live === 'polite' || live === 'assertive') return true;
    const role = current.getAttribute('role');
    if (role === 'alert' || role === 'status') return true;
    current = current.parentElement;
  }

  // Pass also if a field references this element via aria-errormessage or
  // aria-describedby — then the screen reader will announce it on focus.
  const id = node.getAttribute('id');
  if (id) {
    const document = node.ownerDocument;
    const escaped = cssEscape(id);
    const referenced = document.querySelector(
      `[aria-errormessage~="${escaped}"], [aria-describedby~="${escaped}"]`,
    );
    if (referenced) return true;
  }

  return false;
};

export const rule: RuleDefinition = {
  id: 'ariada/checkout/error-identification',
  // CSS selector intentionally case-sensitive (axe-core's internal selector
  // parser rejects the CSS-L4 `... i` flag with "Expected ']' but 'i' found").
  // Broaden the CSS pre-filter and rely on `matches:` (runtime regex) for the
  // case-insensitive narrowing — `looksLikeErrorMessage` already does /…/i.
  selector: '[class], [id]',
  matches: looksLikeErrorMessage,
  any: ['ariada/checkout/error-has-association'],
  all: [],
  none: [],
  tags: ['cat.forms', 'wcag2a', 'wcag2aa', 'wcag331', 'wcag413', 'EAA', 'EAA-I3'],
  metadata,
};

export const checkDefinition = {
  id: 'ariada/checkout/error-has-association',
  evaluate: check,
  metadata: {
    impact: metadata.impact,
    messages: {
      pass: 'Error message is programmatically associated and announceable.',
      fail: 'Error message lacks live-region or field association — screen readers will miss it.',
    },
  },
};
