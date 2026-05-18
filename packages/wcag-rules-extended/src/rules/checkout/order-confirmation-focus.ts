// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
/**
 * Rule: ariada/checkout/order-confirmation-focus
 *
 * Order-confirmation / thank-you pages must have an `<h1>` that contains
 * the confirmation message AND that h1 (or a wrapping region) must be
 * marked with `role="status"` or `aria-live` OR be the first focusable
 * element with `tabindex="-1"` so it can receive focus after navigation.
 *
 * Without this, screen readers land on the new page and announce nothing
 * actionable — the user does not know the purchase succeeded.
 *
 * WCAG SC mapping:
 *   2.4.3 Focus Order (Level A)
 *   2.4.6 Headings and Labels (Level AA)
 *   3.2.5 Change on Request (Level AAA) — informative
 *   4.1.3 Status Messages (Level AA)
 *
 * EN 301 549 v3.2.1: 9.2.4.3, 9.2.4.6, 9.4.1.3
 * EAA Annex I §I.3.
 */

import type { CheckEvaluate, RuleDefinition, RuleMetadata } from '../../types.js';

const HELP_URL =
  'https://github.com/ariada-org/ariada/blob/main/packages/wcag-rules-extended/docs/rules/checkout-order-confirmation-focus.md';

export const metadata: RuleMetadata = {
  description: 'Order confirmation page must have a focusable / live-region h1 with confirmation.',
  help: 'Add role="status" or aria-live="polite" to the confirmation h1, or tabindex=-1 + focus().',
  helpUrl: HELP_URL,
  wcag: ['2.4.3', '2.4.6', '4.1.3'],
  en301549: ['9.2.4.3', '9.2.4.6', '9.4.1.3'],
  eaaAnnexI: ['I.3'],
  impact: 'serious',
};

const CONFIRMATION_TOKENS =
  /\b(thank|order\s+(confirmed|placed|received|success)|confirmation|tack|kiitos|takk|bekräft|vahvist|bestilling|bestälning)\b/i;

function isConfirmationHeading(node: Element): boolean {
  const tag = node.tagName.toLowerCase();
  if (tag !== 'h1') return false;
  const text = (node.textContent ?? '').trim();
  return CONFIRMATION_TOKENS.test(text);
}

export const check: CheckEvaluate = (node) => {
  if (!isConfirmationHeading(node)) return true;

  // Live-region mechanism on self or ancestor
  let cur: Element | null = node;
  while (cur) {
    const live = cur.getAttribute('aria-live');
    if (live === 'polite' || live === 'assertive') return true;
    const role = cur.getAttribute('role');
    if (role === 'status' || role === 'alert') return true;
    cur = cur.parentElement;
  }

  // Or h1 is programmatically focusable. Accept either:
  //   - any negative tabindex (-1, -2, …) — focusable via .focus() but skipped
  //     by Tab navigation; canonical pattern for post-navigation focus targets
  //   - tabindex="0" — focusable both programmatically AND via Tab key, also
  //     legitimate for a heading that should be reachable
  // Positive tabindex values are rejected — they reorder the document tab
  // sequence and constitute a WCAG 2.4.3 Focus Order anti-pattern.
  const ti = node.getAttribute('tabindex');
  if (ti !== null) {
    const n = Number.parseInt(ti, 10);
    if (Number.isFinite(n) && n <= 0) return true;
  }

  return false;
};

export const rule: RuleDefinition = {
  id: 'ariada/checkout/order-confirmation-focus',
  selector: 'h1',
  matches: isConfirmationHeading,
  any: ['ariada/checkout/confirmation-has-focus-or-live'],
  all: [],
  none: [],
  tags: ['cat.semantics', 'wcag2a', 'wcag2aa', 'wcag243', 'wcag246', 'wcag413', 'EAA', 'EAA-I3'],
  metadata,
};

export const checkDefinition = {
  id: 'ariada/checkout/confirmation-has-focus-or-live',
  evaluate: check,
  metadata: {
    impact: metadata.impact,
    messages: {
      pass: 'Confirmation heading is focusable or announced via live region.',
      fail: 'Confirmation heading is not announced — screen readers will miss the success message.',
    },
  },
};
