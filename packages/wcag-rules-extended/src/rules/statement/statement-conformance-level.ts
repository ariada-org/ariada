// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
/**
 * Rule: ariada/statement/conformance-level-declared
 *
 * The accessibility statement MUST declare a conformance status per
 * EN 301 549 / DOS-lagen taxonomy:
 *   - "fully conformant" / "fullt förenligt" / "täysin yhdenmukainen"
 *   - "partially conformant" / "delvis förenligt" / "osittain yhdenmukainen"
 *   - "non conformant" / "inte förenligt" / "ei yhdenmukainen"
 *
 * WCAG SC: 3.2.6 (informative).
 * EN 301 549 v3.2.1: 12.1.1.
 * Directive (EU) 2016/2102 art. 7(1)(a).
 */

import type { CheckEvaluate, RuleDefinition, RuleMetadata } from '../../types.js';

import { isStatementPage, statementText } from './_shared.js';

const HELP_URL =
  'https://github.com/ariada-org/ariada/blob/main/packages/wcag-rules-extended/docs/rules/statement-conformance-level.md';

export const metadata: RuleMetadata = {
  description: 'Accessibility statement must declare a conformance level (full/partial/non).',
  help: 'State explicitly whether the website is fully, partially, or non-conformant with WCAG 2.2 AA.',
  helpUrl: HELP_URL,
  wcag: ['3.2.6'],
  en301549: ['12.1.1'],
  eaaAnnexI: ['I.1'],
  impact: 'moderate',
};

const CONFORMANCE_PATTERNS = [
  /\b(fully|fully\s+conformant|full\s+conformance)\b/i,
  /\b(partially|partially\s+conformant|partial\s+conformance)\b/i,
  /\b(non[\s-]?conformant|not\s+conformant)\b/i,
  // Swedish
  /\b(fullt\s+förenlig|delvis\s+förenlig|inte\s+förenlig)/i,
  // Norwegian
  /\b(fullt\s+samsvar|delvis\s+samsvar|ikke\s+samsvar)/i,
  // Danish
  /\b(fuldt\s+overensstemmende|delvist\s+overensstemmende|ikke\s+overensstemmende)/i,
  // Finnish
  /\b(t[äa]ysin\s+yhdenmukai|osittain\s+yhdenmukai|ei\s+yhdenmukai)/i,
];

export const check: CheckEvaluate = (node) => {
  const document = node.ownerDocument;
  if (!isStatementPage(document)) return true;
  const text = statementText(document);
  return CONFORMANCE_PATTERNS.some((p) => p.test(text));
};

export const rule: RuleDefinition = {
  id: 'ariada/statement/conformance-level-declared',
  selector: 'html',
  any: ['ariada/statement/has-conformance-declaration'],
  all: [],
  none: [],
  tags: ['cat.semantics', 'wcag22a', 'wcag326', 'EAA', 'EAA-I1'],
  metadata,
};

export const checkDefinition = {
  id: 'ariada/statement/has-conformance-declaration',
  evaluate: check,
  metadata: {
    impact: metadata.impact,
    messages: {
      pass: 'Statement declares conformance level.',
      fail: 'Statement does not declare full / partial / non conformance status.',
    },
  },
};
