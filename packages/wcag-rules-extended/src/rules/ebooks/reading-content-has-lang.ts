// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
/**
 * Rule: ariada/ebooks/reading-content-has-lang
 *
 * An embedded reading surface — an e-book chapter rendered inside a host page —
 * may be in a different language than the host document's `<html lang>`. Screen
 * readers pick pronunciation and synthetic-voice rules from the nearest `lang`
 * declaration, so each reading region must declare its own language (or inherit
 * a valid one from an ancestor up to the document element). Without it the
 * chapter is read with the wrong voice.
 *
 * WCAG SC: 3.1.1 Language of Page (Level A).
 */

import type { CheckEvaluate, RuleDefinition, RuleMetadata } from '../../types.js';

const HELP_URL =
  'https://github.com/ariada-org/ariada/blob/main/packages/wcag-rules-extended/docs/rules/ebooks-reading-content-has-lang.md';

export const metadata: RuleMetadata = {
  description: 'Embedded reading regions must declare a language (WCAG 3.1.1).',
  help: 'Add a valid BCP-47 lang attribute to the reading region or an ancestor.',
  helpUrl: HELP_URL,
  wcag: ['3.1.1'],
  en301549: ['9.3.1.1'],
  eaaAnnexI: ['I.5'],
  impact: 'serious',
};

function looksLikeReadingRoot(node: Element): boolean {
  if (node.tagName.toLowerCase() === 'article') return true;
  const role = (node.getAttribute('role') ?? '').trim().toLowerCase();
  if (role === 'document' || role === 'article') return true;
  return node.hasAttribute('data-reading-content');
}

// A plausible BCP-47 language tag: 2-3 letter primary subtag, optional
// hyphen-separated subtags (script, region, etc.). Not a full registry check.
const BCP47_RE = /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/i;

export const check: CheckEvaluate = (node) => {
  if (!looksLikeReadingRoot(node)) return true;
  // Nearest lang-bearing ancestor-or-self, up to and including the document element.
  const langHolder = node.closest('[lang]');
  if (!langHolder) return false;
  const lang = (langHolder.getAttribute('lang') ?? '').trim();
  if (!lang) return false;
  return BCP47_RE.test(lang);
};

export const rule: RuleDefinition = {
  id: 'ariada/ebooks/reading-content-has-lang',
  selector: 'article, [role="document"], [role="article"], [data-reading-content]',
  matches: looksLikeReadingRoot,
  any: ['ariada/ebooks/reading-region-declares-lang'],
  all: [],
  none: [],
  tags: ['cat.language', 'wcag2a', 'wcag311', 'EAA', 'EAA-I5'],
  metadata,
};

export const checkDefinition = {
  id: 'ariada/ebooks/reading-region-declares-lang',
  evaluate: check,
  metadata: {
    impact: metadata.impact,
    messages: {
      pass: 'Reading region declares a valid language.',
      fail: 'Reading region (or page) must declare a valid language via lang.',
    },
  },
};
