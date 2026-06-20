// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
/**
 * Rule: ariada/checkout/step-keyboard-accessible
 *
 * Checkout step indicators / progress trackers (typically a list of
 * "Cart → Shipping → Payment → Confirmation" badges) must be navigable
 * with keyboard. If implemented as clickable elements (`<a>`, `<button>`,
 * or anything with a `click` handler indicated by `cursor: pointer`),
 * they MUST be focusable (`tabindex >= 0` or natively focusable element).
 *
 * Non-focusable `<div onclick>` patterns are blockers for keyboard-only
 * users on the checkout funnel.
 *
 * WCAG SC mapping:
 *   2.1.1 Keyboard (Level A)
 *   2.1.2 No Keyboard Trap (Level A)
 *   4.1.2 Name, Role, Value (Level A)
 *
 * EN 301 549 v3.2.1: 9.2.1.1, 9.4.1.2
 * EAA Annex I §I.3.
 */

import type { CheckEvaluate, RuleDefinition, RuleMetadata } from '../../types.js';

const HELP_URL =
  'https://github.com/ariada-org/ariada/blob/main/packages/wcag-rules-extended/docs/rules/checkout-step-keyboard.md';

export const metadata: RuleMetadata = {
  description: 'Checkout step indicators that are clickable must be keyboard-focusable.',
  help: 'Use <a> or <button>, or add tabindex="0" and role="link"/"button" to non-native elements.',
  helpUrl: HELP_URL,
  wcag: ['2.1.1', '4.1.2'],
  en301549: ['9.2.1.1', '9.4.1.2'],
  eaaAnnexI: ['I.3'],
  impact: 'serious',
};

function isCheckoutStepIndicator(node: Element): boolean {
  const cls = node.getAttribute('class') ?? '';
  const idAttribute = node.getAttribute('id') ?? '';
  const dataRole = node.getAttribute('data-role') ?? '';
  const combined = `${cls} ${idAttribute} ${dataRole}`;
  return /\b(step|stepper|progress|checkout[-_]?step|wizard[-_]?step)\b/i.test(combined);
}

function isFocusable(element: Element): boolean {
  const tag = element.tagName.toLowerCase();
  if (tag === 'a' && element.hasAttribute('href')) return true;
  if (tag === 'button') return true;
  if (tag === 'input' || tag === 'select' || tag === 'textarea') return true;
  const ti = element.getAttribute('tabindex');
  if (ti !== null) {
    const n = Number.parseInt(ti, 10);
    return Number.isFinite(n) && n >= 0;
  }
  return false;
}

function looksClickable(element: Element): boolean {
  if (element.hasAttribute('onclick')) return true;
  // Heuristic: presence of explicit role implies interactivity expectation
  const role = element.getAttribute('role');
  if (role === 'button' || role === 'link' || role === 'tab') return true;
  // Common framework class hints
  const cls = element.getAttribute('class') ?? '';
  if (/\b(clickable|interactive|cursor-pointer)\b/i.test(cls)) return true;
  return false;
}

export const check: CheckEvaluate = (node) => {
  if (!isCheckoutStepIndicator(node)) return true;
  if (!looksClickable(node)) return true; // Static indicator — keyboard not required
  return isFocusable(node);
};

export const rule: RuleDefinition = {
  id: 'ariada/checkout/step-keyboard-accessible',
  // CSS selector intentionally case-sensitive (axe-core's internal selector
  // parser rejects the CSS-L4 `... i` flag with "Expected ']' but 'i' found").
  // Broaden the CSS pre-filter and rely on `matches:` (runtime regex) for the
  // case-insensitive narrowing — `isCheckoutStepIndicator` already does /…/i.
  selector: '[class], [id], [data-role]',
  matches: isCheckoutStepIndicator,
  any: ['ariada/checkout/step-is-focusable-if-clickable'],
  all: [],
  none: [],
  tags: ['cat.keyboard', 'wcag2a', 'wcag211', 'wcag412', 'EAA', 'EAA-I3'],
  metadata,
};

export const checkDefinition = {
  id: 'ariada/checkout/step-is-focusable-if-clickable',
  evaluate: check,
  metadata: {
    impact: metadata.impact,
    messages: {
      pass: 'Checkout step indicator is keyboard-accessible.',
      fail: 'Clickable checkout step is not keyboard-focusable — keyboard users cannot navigate.',
    },
  },
};
