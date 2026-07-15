// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
/**
 * Rule: ariada/statement/page-link-from-footer
 *
 * Every public page MUST include a link to the accessibility statement
 * page at one of the conventional URLs (per DOS-lagen / EN 301 549).
 * Conventional paths (case-insensitive):
 *   /accessibility, /accessibility-statement, /a11y, /a11y-statement,
 *   /tillganglighet, /tillgänglighet, /tilgjengelighet, /tilgaengelighed,
 *   /saavutettavuus, /saavutettavuusseloste
 *
 * This rule runs ONCE per page (selector `html`) and checks whether the
 * document contains any anchor link matching one of those paths.
 *
 * WCAG SC: not directly mapped — this is an EAA / DOS-lagen requirement,
 * not a WCAG SC. However, WCAG 3.2.6 Consistent Help (Level A, WCAG 2.2)
 * is the closest cousin.
 *
 * EN 301 549 v3.2.1: clause 12.1.1 (Accessibility documentation).
 * EAA Annex I §I.1 (general — accessibility documentation accessible).
 * DOS-lagen (SE, transposes Directive (EU) 2016/2102): article 7 — public
 * sector accessibility statements; mirrored for EAA private-sector by §I.3.
 */

import type { CheckEvaluate, RuleDefinition, RuleMetadata } from '../../types.js';

const HELP_URL =
  'https://github.com/ariada-org/ariada/blob/main/packages/wcag-rules-extended/docs/rules/statement-page-link-from-footer.md';

export const metadata: RuleMetadata = {
  description: 'Every page must link to the accessibility statement at a conventional URL.',
  help: 'Add a footer link <a href="/accessibility"> (or /tillgänglighet / /saavutettavuus).',
  helpUrl: HELP_URL,
  wcag: ['3.2.6'],
  en301549: ['12.1.1'],
  eaaAnnexI: ['I.1', 'I.3'],
  impact: 'serious',
};

const CONVENTIONAL_PATHS = [
  /\/accessibility(-statement)?(\/|$|\?|#)/i,
  /\/a11y(-statement)?(\/|$|\?|#)/i,
  /\/tillganglighet(\/|$|\?|#)/i,
  /\/tillg%C3%A4nglighet(\/|$|\?|#)/i, // URL-encoded ä
  /\/tilgjengelighet(\/|$|\?|#)/i,
  /\/tilgaengelighed(\/|$|\?|#)/i,
  /\/tilg%C3%A6ngelighed(\/|$|\?|#)/i,
  /\/saavutettavuus(seloste)?(\/|$|\?|#)/i,
  /\/erklaerung-zur-barrierefreiheit(\/|$|\?|#)/i, // DE — supported as bonus
  /\/declaration-accessibilite(\/|$|\?|#)/i, // FR — bonus
];

function looksLikeStatementLink(href: string): boolean {
  if (!href) return false;
  return CONVENTIONAL_PATHS.some((p) => p.test(href));
}

export const check: CheckEvaluate = (node) => {
  // Only run once per page — selector is `html` so node is the document root.
  const doc = node.ownerDocument;
  const anchors = doc.querySelectorAll('a[href]');
  for (const a of Array.from(anchors)) {
    const href = a.getAttribute('href') ?? '';
    if (looksLikeStatementLink(href)) return true;
  }
  return false;
};

export const rule: RuleDefinition = {
  id: 'ariada/statement/page-link-from-footer',
  selector: 'html',
  any: ['ariada/statement/has-link-to-statement'],
  all: [],
  none: [],
  tags: ['cat.semantics', 'wcag22a', 'wcag326', 'EAA', 'EAA-I1'],
  metadata,
};

export const checkDefinition = {
  id: 'ariada/statement/has-link-to-statement',
  evaluate: check,
  metadata: {
    impact: metadata.impact,
    messages: {
      pass: 'Page links to an accessibility statement at a conventional URL.',
      fail: 'Page has no link to /accessibility (or localised equivalent) — EAA / DOS-lagen requirement.',
    },
  },
};
