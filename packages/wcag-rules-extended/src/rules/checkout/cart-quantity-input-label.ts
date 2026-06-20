// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
/**
 * Rule: ariada/checkout/cart-quantity-input-label
 *
 * Cart-item quantity inputs must have an accessible name that distinguishes
 * them from each other. A page with "Qty" labelling 5 inputs is ambiguous —
 * the label must convey which product's quantity is being edited.
 *
 * WCAG SC mapping:
 *   3.3.2 Labels or Instructions (Level A)
 *   1.3.1 Info and Relationships (Level A)
 *   4.1.2 Name, Role, Value (Level A)
 *
 * EN 301 549 v3.2.1: 9.3.3.2, 9.1.3.1, 9.4.1.2
 * EAA Annex I §I.3.
 */

import { getAccessibleNameLite } from '../../helpers.js';
import type { CheckEvaluate, RuleDefinition, RuleMetadata } from '../../types.js';

const HELP_URL =
  'https://github.com/ariada-org/ariada/blob/main/packages/wcag-rules-extended/docs/rules/checkout-cart-quantity-input-label.md';

export const metadata: RuleMetadata = {
  description: 'Cart item quantity inputs must have product-distinguishing accessible names.',
  help: 'Use aria-label="Quantity of <product name>" or aria-labelledby referencing product name.',
  helpUrl: HELP_URL,
  wcag: ['3.3.2', '1.3.1', '4.1.2'],
  en301549: ['9.3.3.2', '9.1.3.1', '9.4.1.2'],
  eaaAnnexI: ['I.3'],
  impact: 'moderate',
};

function looksLikeQuantityInput(node: Element): boolean {
  if (node.tagName.toLowerCase() !== 'input') return false;
  const t = (node.getAttribute('type') ?? '').toLowerCase();
  if (t !== 'number' && t !== 'text') return false;
  const name = node.getAttribute('name') ?? '';
  const id = node.getAttribute('id') ?? '';
  const cls = node.getAttribute('class') ?? '';
  return /\b(qty|quantity|antal|määrä|mængde|antall)\b/i.test(`${name} ${id} ${cls}`);
}

export const check: CheckEvaluate = (node) => {
  if (!looksLikeQuantityInput(node)) return true;
  const accumulatorName = getAccessibleNameLite(node).trim().toLowerCase();
  if (!accumulatorName) return false;
  // Generic / non-distinguishing labels — fail
  if (
    accumulatorName === 'qty' ||
    accumulatorName === 'quantity' ||
    accumulatorName === 'antal' ||
    accumulatorName === 'antall' ||
    accumulatorName === 'määrä' ||
    accumulatorName === 'mængde'
  ) {
    return false;
  }
  return accumulatorName.length >= 3;
};

export const rule: RuleDefinition = {
  id: 'ariada/checkout/cart-quantity-input-label',
  selector: 'input[type="number"], input[type="text"]',
  matches: looksLikeQuantityInput,
  any: ['ariada/checkout/quantity-has-distinguishing-label'],
  all: [],
  none: [],
  tags: ['cat.forms', 'wcag2a', 'wcag332', 'wcag131', 'EAA', 'EAA-I3'],
  metadata,
};

export const checkDefinition = {
  id: 'ariada/checkout/quantity-has-distinguishing-label',
  evaluate: check,
  metadata: {
    impact: metadata.impact,
    messages: {
      pass: 'Quantity input has a product-distinguishing label.',
      fail: 'Quantity input label is generic ("Qty") — must include the product name.',
    },
  },
};
