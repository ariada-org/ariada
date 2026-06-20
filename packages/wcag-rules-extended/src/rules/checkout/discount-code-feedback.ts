// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
/**
 * Rule: ariada/checkout/discount-code-feedback
 *
 * Discount / promo code input fields must have a feedback mechanism — a
 * sibling status region (or `aria-describedby` target) that can announce
 * "Code applied: 10% off" or "Invalid code" to assistive technology.
 *
 * Without this, sighted users see "✓ Code applied!" but screen reader users
 * receive no confirmation, making the feature unusable.
 *
 * WCAG SC mapping:
 *   3.3.1 Error Identification (Level A)
 *   4.1.3 Status Messages (Level AA)
 *
 * EN 301 549 v3.2.1: 9.3.3.1, 9.4.1.3
 * EAA Annex I §I.3.
 */

import { getAccessibleNameLite } from '../../helpers.js';
import type { CheckEvaluate, RuleDefinition, RuleMetadata } from '../../types.js';

const HELP_URL =
  'https://github.com/ariada-org/ariada/blob/main/packages/wcag-rules-extended/docs/rules/checkout-discount-code-feedback.md';

export const metadata: RuleMetadata = {
  description: 'Discount-code input must have an associated feedback / status region.',
  help: 'Add aria-describedby pointing to a region with role=status or aria-live="polite".',
  helpUrl: HELP_URL,
  wcag: ['3.3.1', '4.1.3'],
  en301549: ['9.3.3.1', '9.4.1.3'],
  eaaAnnexI: ['I.3'],
  impact: 'moderate',
};

function looksLikeDiscountCodeField(node: Element): boolean {
  if (node.tagName.toLowerCase() !== 'input') return false;
  const t = (node.getAttribute('type') ?? 'text').toLowerCase();
  if (t !== 'text') return false;
  const name = node.getAttribute('name') ?? '';
  const id = node.getAttribute('id') ?? '';
  const accumulatorName = getAccessibleNameLite(node);
  // Nordic compound discipline:
  //   Swedish "rabatt" + "rabattkod" (compound) → start boundary only.
  //   Norwegian Bokmål "rabatt"/"rabattkode" → ditto.
  //   Danish "rabat" (single-t) + "rabatkode" → separate alternative.
  //   Finnish "alennus" + "alennuskoodi" (compound) → start boundary only.
  // JS `\b` uses ASCII word-char definition; for Nordic letters (å/ä/ö/æ/ø)
  // we use a Unicode-aware negative lookbehind `(?<![\p{L}\d_])` so e.g.
  // "rabattkode" matches "rabatt" (no trailing boundary required). Trailing
  // boundary intentionally dropped so compounds match — pattern tokens are
  // distinct enough that over-match is acceptable (form-attribute corpus).
  return /(?<![\p{L}\d_])(coupon|promo|discount|voucher|gift[-_ ]?card|rabatt|rabat|kupong|alennus)/iu.test(
    `${name} ${id} ${accumulatorName}`,
  );
}

export const check: CheckEvaluate = (node) => {
  if (!looksLikeDiscountCodeField(node)) return true;
  const describedBy = node.getAttribute('aria-describedby');
  const document = node.ownerDocument;

  if (describedBy) {
    const ids = describedBy.split(/\s+/).filter(Boolean);
    for (const id of ids) {
      const target = document.getElementById(id);
      if (!target) continue;
      const role = target.getAttribute('role');
      const live = target.getAttribute('aria-live');
      if (
        role === 'status' ||
        role === 'alert' ||
        live === 'polite' ||
        live === 'assertive'
      ) {
        return true;
      }
    }
  }

  // Also accept ancestor with feedback region — the field is in a region
  // whose live area is the implicit destination
  const ancestor = node.closest('[aria-live], [role="status"], [role="alert"]');
  if (ancestor) return true;

  return false;
};

export const rule: RuleDefinition = {
  id: 'ariada/checkout/discount-code-feedback',
  selector: 'input[type="text"]',
  matches: looksLikeDiscountCodeField,
  any: ['ariada/checkout/discount-has-feedback-region'],
  all: [],
  none: [],
  tags: ['cat.forms', 'wcag2a', 'wcag2aa', 'wcag331', 'wcag413', 'EAA', 'EAA-I3'],
  metadata,
};

export const checkDefinition = {
  id: 'ariada/checkout/discount-has-feedback-region',
  evaluate: check,
  metadata: {
    impact: metadata.impact,
    messages: {
      pass: 'Discount code field has an associated feedback region.',
      fail: 'Discount code field lacks aria-describedby pointing to a live status region.',
    },
  },
};
