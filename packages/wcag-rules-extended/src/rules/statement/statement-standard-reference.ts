// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
/**
 * Rule: ariada/statement/standard-reference
 *
 * The accessibility statement MUST reference the conformance standard
 * being claimed — at minimum WCAG 2.2 AA (or WCAG 2.1 AA grandfathered
 * for pre-2025 statements) AND/OR EN 301 549 v3.x.
 *
 * Per EAA-2025 transposition, EN 301 549 v3.2.1 is the harmonised standard.
 */

import type { CheckEvaluate, RuleDefinition, RuleMetadata } from '../../types.js';

import { isStatementPage, statementText } from './_shared.js';

const HELP_URL =
  'https://github.com/ariada-org/ariada/blob/main/packages/wcag-rules-extended/docs/rules/statement-standard-reference.md';

export const metadata: RuleMetadata = {
  description: 'Statement must reference WCAG 2.2 AA or EN 301 549 v3.2.1.',
  help: 'Mention the standard explicitly: "WCAG 2.2 level AA" or "EN 301 549 v3.2.1".',
  helpUrl: HELP_URL,
  wcag: ['3.2.6'],
  en301549: ['12.1.1'],
  eaaAnnexI: ['I.1'],
  impact: 'minor',
};

const STANDARD_RE =
  /\b(WCAG\s*(2\.[012])(\s*(level\s*)?(A{1,3}|aa|aaa))?|EN\s*301\s*549(\s*v?3(\.\d)*)?)\b/i;

export const check: CheckEvaluate = (node) => {
  const doc = node.ownerDocument;
  if (!isStatementPage(doc)) return true;
  return STANDARD_RE.test(statementText(doc));
};

export const rule: RuleDefinition = {
  id: 'ariada/statement/standard-reference',
  selector: 'html',
  any: ['ariada/statement/has-standard-reference'],
  all: [],
  none: [],
  tags: ['cat.semantics', 'wcag22a', 'wcag326', 'EAA', 'EAA-I1'],
  metadata,
};

export const checkDefinition = {
  id: 'ariada/statement/has-standard-reference',
  evaluate: check,
  metadata: {
    impact: metadata.impact,
    messages: {
      pass: 'Statement references WCAG / EN 301 549.',
      fail: 'Statement does not name the conformance standard (WCAG 2.2 AA / EN 301 549 v3.2.1).',
    },
  },
};
