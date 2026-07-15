// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
/**
 * Rule: ariada/statement/feedback-mechanism-present
 *
 * The accessibility statement MUST provide a feedback mechanism — an
 * email address (`<a href="mailto:">`), a phone number, or a contact form
 * URL — so users can report inaccessible content (Directive 2016/2102 art.
 * 7(1)(b); EAA mirrors this for private-sector services).
 */

import type { CheckEvaluate, RuleDefinition, RuleMetadata } from '../../types.js';

import { isStatementPage } from './_shared.js';

const HELP_URL =
  'https://github.com/ariada-org/ariada/blob/main/packages/wcag-rules-extended/docs/rules/statement-feedback-mechanism.md';

export const metadata: RuleMetadata = {
  description: 'Accessibility statement must include a feedback mechanism (email / phone / form).',
  help: 'Add <a href="mailto:a11y@example.com"> or a link to a contact form on the statement page.',
  helpUrl: HELP_URL,
  wcag: ['3.2.6'],
  en301549: ['12.1.1'],
  eaaAnnexI: ['I.1'],
  impact: 'serious',
};

export const check: CheckEvaluate = (node) => {
  const doc = node.ownerDocument;
  if (!isStatementPage(doc)) return true;
  // mailto: link
  if (doc.querySelector('a[href^="mailto:"]')) return true;
  // tel: link
  if (doc.querySelector('a[href^="tel:"]')) return true;
  // Contact form / contact page link
  const links = doc.querySelectorAll('a[href]');
  for (const a of Array.from(links)) {
    const href = a.getAttribute('href') ?? '';
    if (
      /\/(contact|kontakt|yhteystiedot|feedback|palaute)/i.test(href) ||
      /\/(report|rapport|ilmoita)/i.test(href)
    ) {
      return true;
    }
  }
  // Email pattern in plain text (very loose — accept as last resort)
  const text = doc.body?.textContent ?? '';
  if (/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(text)) return true;
  return false;
};

export const rule: RuleDefinition = {
  id: 'ariada/statement/feedback-mechanism-present',
  selector: 'html',
  any: ['ariada/statement/has-feedback-mechanism'],
  all: [],
  none: [],
  tags: ['cat.semantics', 'wcag22a', 'wcag326', 'EAA', 'EAA-I1'],
  metadata,
};

export const checkDefinition = {
  id: 'ariada/statement/has-feedback-mechanism',
  evaluate: check,
  metadata: {
    impact: metadata.impact,
    messages: {
      pass: 'Statement provides a feedback mechanism.',
      fail: 'Statement has no email, phone, or contact-form link for accessibility feedback.',
    },
  },
};
