// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
/**
 * Rule: ariada/checkout/autocomplete-personal-data
 *
 * Form fields collecting personal data (name, address, email, phone, etc.)
 * SHOULD declare the appropriate `autocomplete` attribute per the WHATWG
 * HTML autocomplete taxonomy. This enables WCAG 1.3.5 Identify Input Purpose
 * and helps users with cognitive disabilities by pre-filling known fields.
 *
 * WCAG SC mapping:
 *   1.3.5 Identify Input Purpose (Level AA)
 *
 * EN 301 549 v3.2.1: 9.1.3.5
 * EAA Annex I §I.3.
 */

import { getAccessibleNameLite } from '../../helpers.js';
import type { CheckEvaluate, RuleDefinition, RuleMetadata } from '../../types.js';

const HELP_URL =
  'https://github.com/ariada-org/ariada/blob/main/packages/wcag-rules-extended/docs/rules/checkout-autocomplete-personal-data.md';

export const metadata: RuleMetadata = {
  description: 'Personal-data form fields must declare appropriate autocomplete attribute.',
  help: 'Add autocomplete="email" / "tel" / "name" / "street-address" etc. per WHATWG taxonomy.',
  helpUrl: HELP_URL,
  wcag: ['1.3.5'],
  en301549: ['9.1.3.5'],
  eaaAnnexI: ['I.3'],
  impact: 'moderate',
};

/**
 * Field name / label tokens that map to autocomplete values per WHATWG:
 *   https://html.spec.whatwg.org/multipage/form-control-infrastructure.html#autofill
 *
 * Keys are case-insensitive regex patterns matched against name attribute,
 * id attribute, and accessible name. The value is informational only —
 * the rule passes if ANY non-empty autocomplete attribute is present.
 */
const PERSONAL_FIELD_PATTERNS: Array<{ pattern: RegExp; suggested: string }> = [
  { pattern: /\b(email|e[-_ ]?mail|e[-_ ]?post)\b/i, suggested: 'email' },
  { pattern: /\b(phone|tel|mobil|telefon|puhelin)\b/i, suggested: 'tel' },
  { pattern: /\b(first[-_ ]?name|fornavn|förnamn|etunimi)\b/i, suggested: 'given-name' },
  { pattern: /\b(last[-_ ]?name|surname|efternamn|sukunimi|etternavn)\b/i, suggested: 'family-name' },
  { pattern: /\b(full[-_ ]?name)\b/i, suggested: 'name' },
  { pattern: /\b(address|adress|adresse|osoite)\b/i, suggested: 'street-address' },
  { pattern: /\b(city|ort|stad|postnr|by|kaupunki)\b/i, suggested: 'address-level2' },
  { pattern: /\b(postal|postcode|zip|postnr|postnummer|postinumero)\b/i, suggested: 'postal-code' },
  { pattern: /\b(country|land|maa)\b/i, suggested: 'country' },
];

function looksLikePersonalDataField(node: Element): boolean {
  const tag = node.tagName.toLowerCase();
  if (!['input', 'select', 'textarea'].includes(tag)) return false;
  if (tag === 'input') {
    const t = (node.getAttribute('type') ?? 'text').toLowerCase();
    if (['hidden', 'submit', 'button', 'reset', 'image', 'file', 'checkbox', 'radio'].includes(t)) {
      return false;
    }
    // Native email/tel types are auto-classified by browsers — still benefit
    // from explicit autocomplete but we accept them as passing if any
    // autocomplete is set. We DO include them in the check.
  }
  const name = node.getAttribute('name') ?? '';
  const id = node.getAttribute('id') ?? '';
  const label = getAccessibleNameLite(node);
  const haystack = `${name} ${id} ${label}`;
  return PERSONAL_FIELD_PATTERNS.some(({ pattern }) => pattern.test(haystack));
}

export const check: CheckEvaluate = (node) => {
  if (!looksLikePersonalDataField(node)) return true;
  const autocomplete = (node.getAttribute('autocomplete') ?? '').trim().toLowerCase();
  if (!autocomplete) return false;
  // Reject autocomplete="off" / "none" — they disable the feature
  if (autocomplete === 'off' || autocomplete === 'none') return false;
  return true;
};

export const rule: RuleDefinition = {
  id: 'ariada/checkout/autocomplete-personal-data',
  selector: 'input, select, textarea',
  matches: looksLikePersonalDataField,
  any: ['ariada/checkout/has-autocomplete'],
  all: [],
  none: [],
  tags: ['cat.forms', 'wcag2aa', 'wcag135', 'EAA', 'EAA-I3'],
  metadata,
};

export const checkDefinition = {
  id: 'ariada/checkout/has-autocomplete',
  evaluate: check,
  metadata: {
    impact: metadata.impact,
    messages: {
      pass: 'Personal-data field has appropriate autocomplete attribute.',
      fail: 'Personal-data field is missing autocomplete attribute (WCAG 1.3.5).',
    },
  },
};
