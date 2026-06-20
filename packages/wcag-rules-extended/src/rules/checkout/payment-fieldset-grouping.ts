// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
/**
 * Rule: ariada/checkout/payment-fieldset-grouping
 *
 * Payment-method radio inputs must be grouped programmatically — either
 * with a `<fieldset>` containing a `<legend>` or with an ARIA `radiogroup`
 * that has an accessible name. Screen reader users rely on the group label
 * to understand the choice being made.
 *
 * WCAG SC mapping:
 *   1.3.1 Info and Relationships (Level A)
 *   4.1.2 Name, Role, Value (Level A)
 *
 * EN 301 549 v3.2.1 cross-reference: 9.1.3.1 (Info and Relationships),
 * 9.4.1.2 (Name, Role, Value).
 *
 * EAA Annex I §I.3 (E-commerce services): consumer payment flows must be
 * usable with assistive technology.
 *
 * @see ../../docs/rules/checkout-payment-fieldset-grouping.md
 */

import { getAccessibleNameLite, cssEscape } from '../../helpers.js';
import type { CheckEvaluate, RuleDefinition, RuleMetadata } from '../../types.js';

const HELP_URL =
  'https://github.com/ariada-org/ariada/blob/main/packages/wcag-rules-extended/docs/rules/checkout-payment-fieldset-grouping.md';

export const metadata: RuleMetadata = {
  description:
    'Payment-method radio inputs must be grouped (fieldset+legend or role=radiogroup with accessible name).',
  help: 'Group payment-method radios in <fieldset><legend> or <div role="radiogroup" aria-label>.',
  helpUrl: HELP_URL,
  wcag: ['1.3.1', '4.1.2'],
  en301549: ['9.1.3.1', '9.4.1.2'],
  eaaAnnexI: ['I.3'],
  impact: 'serious',
};

/**
 * Heuristic: a radio input is a "payment-method radio" if its name attribute
 * matches /pay|payment|tender|checkout/ (case-insensitive). The check is
 * tolerant — false positives are acceptable, false negatives are not.
 */
function looksLikePaymentRadio(node: Element): boolean {
  if (node.tagName.toLowerCase() !== 'input') return false;
  const type = (node.getAttribute('type') ?? '').toLowerCase();
  if (type !== 'radio') return false;
  const name = node.getAttribute('name') ?? '';
  return /pay|payment|tender|checkout|method/i.test(name);
}

/**
 * Return true if the radio has an effective programmatic group.
 *
 * A group is established by either:
 *   - An ancestor `<fieldset>` with a child `<legend>` (HTML native), OR
 *   - An ancestor with `role="radiogroup"` and an accessible name.
 */
export const check: CheckEvaluate = (node) => {
  // Scope: only payment-method radio inputs. Other radios out of scope.
  if (!looksLikePaymentRadio(node)) return true;

  // Skip single-radio cases — those are wrong for a different reason and
  // handled by a separate rule. We need ≥2 radios with the same name.
  const name = node.getAttribute('name');
  if (!name) return true;
  const document = node.ownerDocument;
  const sameName = document.querySelectorAll(
    `input[type="radio"][name="${cssEscape(name)}"]`,
  );
  if (sameName.length < 2) return true;

  // Check fieldset+legend pattern. We look for a direct-child <legend>
  // rather than using `:scope >` selector for happy-dom compatibility.
  const fieldset = node.closest('fieldset');
  if (fieldset) {
    for (const child of Array.from(fieldset.children)) {
      if (child.tagName.toLowerCase() === 'legend') {
        if ((child.textContent ?? '').trim().length > 0) return true;
        break;
      }
    }
  }

  // Check ARIA radiogroup pattern
  const radiogroup = node.closest('[role="radiogroup"]');
  if (radiogroup) {
    const accumulatorName = getAccessibleNameLite(radiogroup);
    if (accumulatorName.length > 0) return true;
  }

  return false;
};

export const rule: RuleDefinition = {
  id: 'ariada/checkout/payment-fieldset-grouping',
  selector: 'input[type="radio"]',
  matches: looksLikePaymentRadio,
  any: ['ariada/checkout/payment-radio-in-group'],
  all: [],
  none: [],
  tags: ['cat.forms', 'wcag2a', 'wcag131', 'wcag412', 'EAA', 'EAA-I3'],
  metadata,
};

export const checkDefinition = {
  id: 'ariada/checkout/payment-radio-in-group',
  evaluate: check,
  metadata: {
    impact: metadata.impact,
    messages: {
      pass: 'Payment radios are in an accessible group.',
      fail: 'Payment radios are not grouped — wrap in <fieldset><legend> or role="radiogroup".',
    },
  },
};
