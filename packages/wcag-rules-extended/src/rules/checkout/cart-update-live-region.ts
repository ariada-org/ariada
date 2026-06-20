// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
/**
 * Rule: ariada/checkout/cart-update-live-region
 *
 * Cart-summary regions that update dynamically (item added, removed, qty
 * changed) MUST announce the change to assistive technology. This requires
 * either `aria-live="polite"` (or "assertive"), or `role="status"`, or
 * `role="alert"` on the updating region.
 *
 * WCAG SC mapping:
 *   4.1.3 Status Messages (Level AA, WCAG 2.1+)
 *
 * EN 301 549 v3.2.1: 9.4.1.3
 * EAA Annex I §I.3.
 *
 * @see ../../docs/rules/checkout-cart-update-live-region.md
 */

import type { CheckEvaluate, RuleDefinition, RuleMetadata } from '../../types.js';

const HELP_URL =
  'https://github.com/ariada-org/ariada/blob/main/packages/wcag-rules-extended/docs/rules/checkout-cart-update-live-region.md';

export const metadata: RuleMetadata = {
  description:
    'Dynamic cart-summary regions must announce updates via aria-live or role=status/alert.',
  help: 'Add aria-live="polite", role="status", or role="alert" to cart-summary elements.',
  helpUrl: HELP_URL,
  wcag: ['4.1.3'],
  en301549: ['9.4.1.3'],
  eaaAnnexI: ['I.3'],
  impact: 'serious',
};

/**
 * Identify a cart-summary region by class / id / data attribute conventions.
 * Heuristic: matches /cart|basket|bag|order[-_]?summary|checkout[-_]?summary/i.
 */
function looksLikeCartRegion(node: Element): boolean {
  const idAttribute = node.getAttribute('id') ?? '';
  const cls = node.getAttribute('class') ?? '';
  const dataRole = node.getAttribute('data-role') ?? '';
  const dataTest = node.getAttribute('data-testid') ?? '';
  const combined = `${idAttribute} ${cls} ${dataRole} ${dataTest}`;
  return /cart|basket|bag|order[-_]?summary|checkout[-_]?summary/i.test(combined);
}

export const check: CheckEvaluate = (node) => {
  if (!looksLikeCartRegion(node)) return true;

  // Pass if any live-region mechanism is present (on node or ancestor)
  let current: Element | null = node;
  while (current) {
    const live = current.getAttribute('aria-live');
    if (live === 'polite' || live === 'assertive') return true;
    const role = current.getAttribute('role');
    if (role === 'status' || role === 'alert' || role === 'log') return true;
    current = current.parentElement;
  }
  return false;
};

export const rule: RuleDefinition = {
  id: 'ariada/checkout/cart-update-live-region',
  // CSS selector intentionally case-sensitive (axe-core's internal selector
  // parser rejects the CSS-L4 `... i` flag with "Expected ']' but 'i' found").
  // Broaden the CSS pre-filter and rely on `matches:` (runtime regex) for the
  // case-insensitive narrowing — `looksLikeCartRegion` already does /…/i.
  selector: '[id], [class], [data-role], [data-testid]',
  matches: looksLikeCartRegion,
  any: ['ariada/checkout/cart-has-live-region'],
  all: [],
  none: [],
  tags: ['cat.aria', 'wcag2aa', 'wcag413', 'EAA', 'EAA-I3'],
  metadata,
};

export const checkDefinition = {
  id: 'ariada/checkout/cart-has-live-region',
  evaluate: check,
  metadata: {
    impact: metadata.impact,
    messages: {
      pass: 'Cart region has a live-region announcement mechanism.',
      fail: 'Cart region lacks aria-live / role=status / role=alert for updates.',
    },
  },
};
