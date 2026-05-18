// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
/**
 * Rule: ariada/checkout/required-field-machine-readable
 *
 * Required form fields must be marked machine-readably (either the native
 * `required` boolean attribute or `aria-required="true"`). Visual-only
 * indicators (e.g. asterisks in labels) are insufficient.
 *
 * WCAG SC mapping:
 *   3.3.2 Labels or Instructions (Level A)
 *   1.3.1 Info and Relationships (Level A)
 *
 * EN 301 549 v3.2.1: 9.3.3.2, 9.1.3.1
 * EAA Annex I §I.3.
 */

import { getAccessibleNameLite } from '../../helpers.js';
import type { CheckEvaluate, RuleDefinition, RuleMetadata } from '../../types.js';

const HELP_URL =
  'https://github.com/ariada-org/ariada/blob/main/packages/wcag-rules-extended/docs/rules/checkout-required-field-machine-readable.md';

export const metadata: RuleMetadata = {
  description:
    'Required form fields must use required attribute or aria-required, not just visual asterisks.',
  help: 'Add required or aria-required="true" to fields whose label contains a "*" indicator.',
  helpUrl: HELP_URL,
  wcag: ['3.3.2', '1.3.1'],
  en301549: ['9.3.3.2', '9.1.3.1'],
  eaaAnnexI: ['I.3'],
  impact: 'serious',
};

/**
 * Heuristic: the rule subject is a form field (input/select/textarea) whose
 * visible label contains an asterisk character (or matches /required|krävs|
 * pakollinen|obligatorisk/ across Nordic languages).
 */
function looksLikeRequiredCandidate(node: Element): boolean {
  const tag = node.tagName.toLowerCase();
  if (!['input', 'select', 'textarea'].includes(tag)) return false;
  if (tag === 'input') {
    const t = (node.getAttribute('type') ?? 'text').toLowerCase();
    if (['hidden', 'submit', 'button', 'reset', 'image'].includes(t)) return false;
  }
  const label = getAccessibleNameLite(node);
  // Required-indicator words across Nordic locales:
  //   Swedish: krävs / obligatorisk
  //   Norwegian Bokmål: påkrevd / obligatorisk
  //   Danish: påkrævet / obligatorisk
  //   Finnish: pakollinen
  // Plus visual asterisk variants (*, ∗, ★) and the English "required".
  return /[*∗★]|required|krävs|pakollinen|obligatorisk|påkrævet|påkrevd/i.test(label);
}

export const check: CheckEvaluate = (node) => {
  if (!looksLikeRequiredCandidate(node)) return true;
  if (node.hasAttribute('required')) return true;
  const ariaReq = node.getAttribute('aria-required');
  if (ariaReq === 'true') return true;
  return false;
};

export const rule: RuleDefinition = {
  id: 'ariada/checkout/required-field-machine-readable',
  selector: 'input, select, textarea',
  matches: looksLikeRequiredCandidate,
  any: ['ariada/checkout/required-attr-or-aria'],
  all: [],
  none: [],
  tags: ['cat.forms', 'wcag2a', 'wcag332', 'wcag131', 'EAA', 'EAA-I3'],
  metadata,
};

export const checkDefinition = {
  id: 'ariada/checkout/required-attr-or-aria',
  evaluate: check,
  metadata: {
    impact: metadata.impact,
    messages: {
      pass: 'Required field declares requirement machine-readably.',
      fail: 'Field labelled as required (visual *) lacks the required or aria-required attribute.',
    },
  },
};
