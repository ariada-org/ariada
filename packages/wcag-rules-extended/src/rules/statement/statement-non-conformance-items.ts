// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
/**
 * Rule: ariada/statement/non-conformance-items-listed
 *
 * If the statement declares "partially conformant" or "non conformant",
 * it MUST enumerate the specific known issues. Look for a list (`<ul>`,
 * `<ol>`, or sequence of headings) with at least 1 item and mention of
 * a WCAG SC number (e.g. "1.3.1") or descriptor.
 *
 * If the statement declares "fully conformant", this rule is skipped.
 *
 * Directive 2016/2102 art. 7(1)(a)(ii); EAA Annex I §I.3.
 */

import type { CheckEvaluate, RuleDefinition, RuleMetadata } from '../../types.js';

import { isStatementPage, statementText } from './_shared.js';

const HELP_URL =
  'https://github.com/ariada-org/ariada/blob/main/packages/wcag-rules-extended/docs/rules/statement-non-conformance-items.md';

export const metadata: RuleMetadata = {
  description: 'Partial / non-conformant statements must list specific known issues.',
  help: 'Add a section "Known accessibility issues" with a bullet list referencing WCAG SCs.',
  helpUrl: HELP_URL,
  wcag: ['3.2.6'],
  en301549: ['12.1.1'],
  eaaAnnexI: ['I.1'],
  impact: 'moderate',
};

// Word-boundary at start only — "partially" matches the "partial" prefix.
const PARTIAL_OR_NON =
  /\b(partial|non[\s-]?conformant|not\s+conformant|delvis\s+förenlig|inte\s+förenlig|delvis\s+samsvar|ikke\s+samsvar|osittain\s+yhdenmukai|ei\s+yhdenmukai)/i;

const FULL_CONFORMANT = /\b(fully\s+conformant|full\s+conformance|fullt\s+förenlig|fullt\s+samsvar|täysin\s+yhdenmukai)/i;

const WCAG_SC_RE = /\b(WCAG|SC|criterion)\s*(\d+\.\d+(\.\d+)?)|\b\d\.\d\.\d\b/i;

export const check: CheckEvaluate = (node) => {
  const document = node.ownerDocument;
  if (!isStatementPage(document)) return true;
  const text = statementText(document);
  // Skip if fully conformant (no need to enumerate)
  if (FULL_CONFORMANT.test(text) && !PARTIAL_OR_NON.test(text)) return true;
  // If partial/non-conformant declared, require a list
  if (!PARTIAL_OR_NON.test(text)) return true; // Conformance level not yet declared — other rule
  const lists = document.querySelectorAll('ul, ol');
  let hasList = false;
  for (const l of Array.from(lists)) {
    if (l.querySelectorAll('li').length >= 1) {
      hasList = true;
      break;
    }
  }
  if (!hasList) return false;
  // Need at least one WCAG SC reference in body
  if (!WCAG_SC_RE.test(text)) return false;
  return true;
};

export const rule: RuleDefinition = {
  id: 'ariada/statement/non-conformance-items-listed',
  selector: 'html',
  any: ['ariada/statement/lists-known-issues'],
  all: [],
  none: [],
  tags: ['cat.semantics', 'wcag22a', 'wcag326', 'EAA', 'EAA-I1'],
  metadata,
};

export const checkDefinition = {
  id: 'ariada/statement/lists-known-issues',
  evaluate: check,
  metadata: {
    impact: metadata.impact,
    messages: {
      pass: 'Statement enumerates known accessibility issues with WCAG SC references.',
      fail: 'Partial/non-conformant statement lacks a list of specific known issues.',
    },
  },
};
