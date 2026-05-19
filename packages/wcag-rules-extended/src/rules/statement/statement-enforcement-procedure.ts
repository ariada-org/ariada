// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
/**
 * Rule: ariada/statement/enforcement-procedure-link
 *
 * The accessibility statement MUST include a link to the national
 * enforcement procedure (e.g. DIGG in Sweden, Difi in Norway, Saavutettavuus
 * Vaatimukset in Finland, Digst in Denmark). This is required by Directive
 * 2016/2102 art. 7(1)(b) — the user must know where to escalate.
 *
 * The rule passes if any link in the statement points to a recognised
 * national enforcement-body domain OR to a generic /enforcement /
 * /klagomaal / /tilsyn / /kantelu page.
 */

import type { CheckEvaluate, RuleDefinition, RuleMetadata } from '../../types.js';

import { isStatementPage } from './_shared.js';

const HELP_URL =
  'https://github.com/ariada-org/ariada/blob/main/packages/wcag-rules-extended/docs/rules/statement-enforcement-procedure.md';

export const metadata: RuleMetadata = {
  description: 'Accessibility statement must link to national enforcement procedure.',
  help: 'Add a link to DIGG (SE), Difi (NO), Digst (DK), or AVI (FI) — or local equivalent.',
  helpUrl: HELP_URL,
  wcag: ['3.2.6'],
  en301549: ['12.1.1'],
  eaaAnnexI: ['I.1'],
  impact: 'moderate',
};

const ENFORCEMENT_HOST_RE =
  /\b(digg\.se|webbtillganglighet\.se|uu\.difi\.no|tilsynet\.no|saavutettavuus(vaatimukset)?\.fi|aviavi\.fi|digst\.dk|hooks\.dk)\b/i;

const ENFORCEMENT_PATH_RE =
  /\/(enforcement|complaint|klagomaal|klagomål|tilsyn|kantelu|barrierefreiheit|reclamation|tilsynsmyndighed)/i;

export const check: CheckEvaluate = (node) => {
  const doc = node.ownerDocument;
  if (!isStatementPage(doc)) return true;
  const anchors = doc.querySelectorAll('a[href]');
  for (const a of Array.from(anchors)) {
    const href = a.getAttribute('href') ?? '';
    if (ENFORCEMENT_HOST_RE.test(href)) return true;
    if (ENFORCEMENT_PATH_RE.test(href)) return true;
  }
  return false;
};

export const rule: RuleDefinition = {
  id: 'ariada/statement/enforcement-procedure-link',
  selector: 'html',
  any: ['ariada/statement/has-enforcement-link'],
  all: [],
  none: [],
  tags: ['cat.semantics', 'wcag22a', 'wcag326', 'EAA', 'EAA-I1'],
  metadata,
};

export const checkDefinition = {
  id: 'ariada/statement/has-enforcement-link',
  evaluate: check,
  metadata: {
    impact: metadata.impact,
    messages: {
      pass: 'Statement links to national enforcement procedure.',
      fail: 'Statement does not link to a national enforcement / complaint procedure.',
    },
  },
};
