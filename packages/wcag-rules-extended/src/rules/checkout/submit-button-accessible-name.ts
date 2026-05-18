// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
/**
 * Rule: ariada/checkout/submit-button-accessible-name
 *
 * Submit buttons in checkout flows must have a meaningful accessible name
 * — not just "Submit" or "Send" or empty. The visible-text-name relationship
 * (WCAG 2.5.3) requires the accessible name to begin with the visible text.
 *
 * WCAG SC mapping:
 *   2.4.4 Link Purpose (In Context) (Level A) — applies to button labels in context
 *   2.5.3 Label in Name (Level A)
 *   4.1.2 Name, Role, Value (Level A)
 *
 * EN 301 549 v3.2.1: 9.2.4.4, 9.2.5.3, 9.4.1.2
 * EAA Annex I §I.3.
 */

import { getAccessibleNameLite } from '../../helpers.js';
import type { CheckEvaluate, RuleDefinition, RuleMetadata } from '../../types.js';

const HELP_URL =
  'https://github.com/ariada-org/ariada/blob/main/packages/wcag-rules-extended/docs/rules/checkout-submit-button-accessible-name.md';

export const metadata: RuleMetadata = {
  description: 'Checkout submit buttons must have a descriptive accessible name.',
  help: 'Use specific labels like "Place order" or "Pay 199 SEK" — not "Submit" or "Send".',
  helpUrl: HELP_URL,
  wcag: ['2.4.4', '2.5.3', '4.1.2'],
  en301549: ['9.2.4.4', '9.2.5.3', '9.4.1.2'],
  eaaAnnexI: ['I.3'],
  impact: 'moderate',
};

/**
 * Generic submit-button text that is too vague for checkout context.
 * Multilingual — Swedish / Norwegian / Danish / Finnish / English.
 */
const VAGUE_LABELS = new Set([
  'submit',
  'send',
  'go',
  'ok',
  'okay',
  'continue',
  'next',
  'click here',
  'button',
  'skicka',
  'fortsätt',
  'klicka',
  'sende',
  'fortsett',
  'lähetä',
  'jatka',
]);

function isCheckoutSubmit(node: Element): boolean {
  const tag = node.tagName.toLowerCase();
  if (tag === 'button') {
    const t = (node.getAttribute('type') ?? 'submit').toLowerCase();
    return t === 'submit';
  }
  if (tag === 'input') {
    const t = (node.getAttribute('type') ?? '').toLowerCase();
    return t === 'submit';
  }
  return false;
}

export const check: CheckEvaluate = (node) => {
  if (!isCheckoutSubmit(node)) return true;
  // Only enforce on submit buttons inside a checkout-ish context
  const inCheckoutContext = !!node.closest(
    'form[class*="checkout" i], form[id*="checkout" i], form[class*="payment" i], [class*="checkout" i] form, [id*="checkout" i] form',
  );
  if (!inCheckoutContext) return true;
  const name =
    getAccessibleNameLite(node) ||
    (node.tagName.toLowerCase() === 'input' ? node.getAttribute('value') ?? '' : '');
  const trimmed = name.trim().toLowerCase();
  if (!trimmed) return false;
  if (VAGUE_LABELS.has(trimmed)) return false;
  return true;
};

export const rule: RuleDefinition = {
  id: 'ariada/checkout/submit-button-accessible-name',
  selector: 'button[type="submit"], button:not([type]), input[type="submit"]',
  matches: isCheckoutSubmit,
  any: ['ariada/checkout/submit-has-meaningful-name'],
  all: [],
  none: [],
  tags: ['cat.name-role-value', 'wcag2a', 'wcag244', 'wcag253', 'wcag412', 'EAA', 'EAA-I3'],
  metadata,
};

export const checkDefinition = {
  id: 'ariada/checkout/submit-has-meaningful-name',
  evaluate: check,
  metadata: {
    impact: metadata.impact,
    messages: {
      pass: 'Submit button has a meaningful, context-specific name.',
      fail: 'Submit button name is too generic ("Submit", "Continue") — use action-specific text.',
    },
  },
};
