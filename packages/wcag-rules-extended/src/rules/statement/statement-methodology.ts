// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
/**
 * Rule: ariada/statement/methodology-disclosed
 *
 * The accessibility statement MUST disclose the methodology used to prepare
 * it — at minimum one of: "self-assessment", "third-party audit",
 * "automated testing", or localised equivalents.
 *
 * Directive 2016/2102 Annex requires the statement to indicate "the method
 * used to prepare it".
 */

import type { CheckEvaluate, RuleDefinition, RuleMetadata } from '../../types.js';

import { isStatementPage, statementText } from './_shared.js';

const HELP_URL =
  'https://github.com/ariada-org/ariada/blob/main/packages/wcag-rules-extended/docs/rules/statement-methodology.md';

export const metadata: RuleMetadata = {
  description: 'Accessibility statement must disclose preparation methodology.',
  help: 'State explicitly: self-assessment, third-party audit, automated tools, or combination.',
  helpUrl: HELP_URL,
  wcag: ['3.2.6'],
  en301549: ['12.1.1'],
  eaaAnnexI: ['I.1'],
  impact: 'minor',
};

// Word-boundary at start only; tail of the match may be a word-character
// (e.g. "self-assessment" — "assess" followed by "ment").
const METHODOLOGY_RE =
  /\b(self[-\s]?assess|third[-\s]?party|external\s+audit|automated\s+(test|scan|tool)|manual\s+review|wcag.*audit|wcag.*evaluat|sj[äa]lvskattning|extern\s+revision|automatiserad|kolmannen\s+osapuolen|itsearvioin|automaatti)/i;

export const check: CheckEvaluate = (node) => {
  const doc = node.ownerDocument;
  if (!isStatementPage(doc)) return true;
  const text = statementText(doc);
  return METHODOLOGY_RE.test(text);
};

export const rule: RuleDefinition = {
  id: 'ariada/statement/methodology-disclosed',
  selector: 'html',
  any: ['ariada/statement/has-methodology'],
  all: [],
  none: [],
  tags: ['cat.semantics', 'wcag22a', 'wcag326', 'EAA', 'EAA-I1'],
  metadata,
};

export const checkDefinition = {
  id: 'ariada/statement/has-methodology',
  evaluate: check,
  metadata: {
    impact: metadata.impact,
    messages: {
      pass: 'Statement discloses preparation methodology.',
      fail: 'Statement does not disclose how it was prepared (self / third-party / automated).',
    },
  },
};
