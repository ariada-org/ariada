// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
/**
 * Rule: ariada/statement/publication-date-present
 *
 * The accessibility statement page MUST declare the publication date in a
 * machine-readable format — either via a `<time datetime="YYYY-MM-DD">`
 * element or a meta tag (`meta[name="published"][content="YYYY-MM-DD"]`).
 *
 * This rule activates ONLY on pages that appear to be the accessibility
 * statement (detected via title / h1 / URL conventions).
 *
 * WCAG SC: 3.2.6 Consistent Help (Level A, WCAG 2.2) — informative.
 * EN 301 549 v3.2.1: 12.1.1 (Accessibility documentation completeness).
 * DOS-lagen art. 7 requires "date the statement was prepared".
 */

import type { CheckEvaluate, RuleDefinition, RuleMetadata } from '../../types.js';

import { isStatementPage } from './_shared.js';

const HELP_URL =
  'https://github.com/ariada-org/ariada/blob/main/packages/wcag-rules-extended/docs/rules/statement-publication-date-present.md';

export const metadata: RuleMetadata = {
  description: 'Accessibility statement must declare publication date in <time datetime=> format.',
  help: 'Add <time datetime="YYYY-MM-DD"> with the publication date inside the statement.',
  helpUrl: HELP_URL,
  wcag: ['3.2.6'],
  en301549: ['12.1.1'],
  eaaAnnexI: ['I.1'],
  impact: 'moderate',
};

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}/;

export const check: CheckEvaluate = (node) => {
  const doc = node.ownerDocument;
  if (!isStatementPage(doc)) return true;

  const times = doc.querySelectorAll('time[datetime]');
  for (const t of Array.from(times)) {
    const dt = t.getAttribute('datetime') ?? '';
    if (ISO_DATE_RE.test(dt)) return true;
  }
  const metas = doc.querySelectorAll(
    'meta[name="published"], meta[name="article:published_time"], meta[property="article:published_time"]',
  );
  for (const m of Array.from(metas)) {
    const content = m.getAttribute('content') ?? '';
    if (ISO_DATE_RE.test(content)) return true;
  }
  return false;
};

export const rule: RuleDefinition = {
  id: 'ariada/statement/publication-date-present',
  selector: 'html',
  any: ['ariada/statement/has-publication-date'],
  all: [],
  none: [],
  tags: ['cat.semantics', 'wcag22a', 'wcag326', 'EAA', 'EAA-I1'],
  metadata,
};

export const checkDefinition = {
  id: 'ariada/statement/has-publication-date',
  evaluate: check,
  metadata: {
    impact: metadata.impact,
    messages: {
      pass: 'Accessibility statement declares publication date.',
      fail: 'Accessibility statement is missing a machine-readable publication date.',
    },
  },
};
