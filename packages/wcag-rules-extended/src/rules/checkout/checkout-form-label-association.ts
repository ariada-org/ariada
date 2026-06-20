// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
/**
 * Rule: ariada/checkout/form-label-association
 *
 * Every interactive form field in a checkout flow MUST have a programmatic
 * label association — either via `<label for="id">`, wrapping `<label>`,
 * `aria-label`, or `aria-labelledby`. Placeholder text alone is insufficient
 * (WCAG 3.3.2 + WCAG 4.1.2 + 1.3.1).
 *
 * This rule is checkout-scoped — it activates only for fields inside
 * forms with checkout-ish class / id markers, to avoid duplicating the
 * upstream axe-core `label` rule on the entire site.
 *
 * WCAG SC mapping:
 *   1.3.1 Info and Relationships (Level A)
 *   3.3.2 Labels or Instructions (Level A)
 *   4.1.2 Name, Role, Value (Level A)
 *
 * EN 301 549 v3.2.1: 9.1.3.1, 9.3.3.2, 9.4.1.2
 * EAA Annex I §I.3.
 */

import { cssEscape } from '../../helpers.js';
import type { CheckEvaluate, RuleDefinition, RuleMetadata } from '../../types.js';

const HELP_URL =
  'https://github.com/ariada-org/ariada/blob/main/packages/wcag-rules-extended/docs/rules/checkout-form-label-association.md';

export const metadata: RuleMetadata = {
  description: 'Every checkout-flow form field must have a programmatic label.',
  help: 'Add <label for="id">, wrap input in <label>, or use aria-label / aria-labelledby.',
  helpUrl: HELP_URL,
  wcag: ['1.3.1', '3.3.2', '4.1.2'],
  en301549: ['9.1.3.1', '9.3.3.2', '9.4.1.2'],
  eaaAnnexI: ['I.3'],
  impact: 'critical',
};

function isCheckoutInput(node: Element): boolean {
  const tag = node.tagName.toLowerCase();
  if (!['input', 'select', 'textarea'].includes(tag)) return false;
  if (tag === 'input') {
    const t = (node.getAttribute('type') ?? 'text').toLowerCase();
    if (['hidden', 'submit', 'button', 'reset', 'image'].includes(t)) return false;
  }
  return !!node.closest(
    'form[class*="checkout" i], form[id*="checkout" i], form[class*="payment" i], [class*="checkout" i] form, [id*="checkout" i] form',
  );
}

function hasProgrammaticLabel(node: Element): boolean {
  if (node.getAttribute('aria-label')?.trim()) return true;
  if (node.getAttribute('aria-labelledby')?.trim()) {
    const document = node.ownerDocument;
    const ids = node.getAttribute('aria-labelledby')!.split(/\s+/).filter(Boolean);
    for (const id of ids) {
      const ref = document.getElementById(id);
      if (ref && (ref.textContent ?? '').trim()) return true;
    }
  }
  const id = node.getAttribute('id');
  if (id) {
    const document = node.ownerDocument;
    const escaped = cssEscape(id);
    const label = document.querySelector(`label[for="${escaped}"]`);
    if (label && (label.textContent ?? '').trim()) return true;
  }
  const wrappingLabel = node.closest('label');
  if (wrappingLabel && (wrappingLabel.textContent ?? '').trim()) return true;
  if (node.getAttribute('title')?.trim()) return true;
  return false;
}

export const check: CheckEvaluate = (node) => {
  if (!isCheckoutInput(node)) return true;
  return hasProgrammaticLabel(node);
};

export const rule: RuleDefinition = {
  id: 'ariada/checkout/form-label-association',
  selector: 'input, select, textarea',
  matches: isCheckoutInput,
  any: ['ariada/checkout/has-programmatic-label'],
  all: [],
  none: [],
  tags: ['cat.forms', 'wcag2a', 'wcag131', 'wcag332', 'wcag412', 'EAA', 'EAA-I3'],
  metadata,
};

export const checkDefinition = {
  id: 'ariada/checkout/has-programmatic-label',
  evaluate: check,
  metadata: {
    impact: metadata.impact,
    messages: {
      pass: 'Checkout field has a programmatic label.',
      fail: 'Checkout field has no programmatic label — placeholder text alone is insufficient.',
    },
  },
};
