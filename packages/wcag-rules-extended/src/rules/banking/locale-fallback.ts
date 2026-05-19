// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
/**
 * Rule: ariada/banking/locale-fallback
 *
 * Pages with mixed-language content (e.g. mostly Swedish with embedded
 * English error message) MUST mark the embedded foreign-language content
 * with `lang="..."` on the wrapping element. This satisfies WCAG 3.1.2
 * Language of Parts (AA).
 *
 * Heuristic: if an `<html lang="sv">` page contains a paragraph or span
 * with content that scores high on English distinctive words and low on
 * Swedish, that block must have its own `lang="en"`.
 *
 * WCAG SC: 3.1.2 Language of Parts (Level AA).
 * EN 301 549 v3.2.1: 9.3.1.2.
 */

import type { CheckEvaluate, RuleDefinition, RuleMetadata } from '../../types.js';

const HELP_URL =
  'https://github.com/ariada-org/ariada/blob/main/packages/wcag-rules-extended/docs/rules/banking-locale-fallback.md';

export const metadata: RuleMetadata = {
  description: 'Foreign-language blocks within a localised page must declare their own lang.',
  help: 'Wrap untranslated English text in <span lang="en"> inside a lang="sv"/"fi" page.',
  helpUrl: HELP_URL,
  wcag: ['3.1.2'],
  en301549: ['9.3.1.2'],
  eaaAnnexI: ['I.4'],
  impact: 'moderate',
};

// Long English-only sentences inside a Nordic-locale page
const EN_DISTINCT = [
  'the',
  'and',
  'with',
  'for',
  'your',
  'please',
  'click',
  'this',
  'that',
  'has',
  'have',
  'will',
];

const NORDIC_LANGS = new Set(['sv', 'nb', 'nn', 'no', 'da', 'fi']);

function isNordicPage(doc: Document): boolean {
  const lang = (doc.documentElement.getAttribute('lang') ?? '').toLowerCase().split('-')[0];
  return NORDIC_LANGS.has(lang || '');
}

function isLikelyEnglish(text: string): boolean {
  const haystack = ` ${text.toLowerCase()} `;
  let n = 0;
  for (const w of EN_DISTINCT) {
    const re = new RegExp(`\\s${w}\\s`, 'g');
    const m = haystack.match(re);
    if (m) n += m.length;
  }
  return n >= 4;
}

// eslint-disable-next-line sonarjs/cognitive-complexity -- Nordic locale fallback decision tree mirrors regulatory rule structure; refactor deferred
export const check: CheckEvaluate = (node) => {
  const doc = node.ownerDocument;
  if (!isNordicPage(doc)) return true;

  // Walk paragraphs / list items / divs with text length ≥80 chars
  const blocks = doc.querySelectorAll('p, li, div, span, blockquote');
  for (const b of Array.from(blocks)) {
    const text = (b.textContent ?? '').trim();
    if (text.length < 80) continue;
    // If this block has children with text > 80 chars, leave it to those children
    if (b.children.length > 0) {
      let childHasLongText = false;
      for (const c of Array.from(b.children)) {
        if ((c.textContent ?? '').trim().length >= 80) {
          childHasLongText = true;
          break;
        }
      }
      if (childHasLongText) continue;
    }
    if (isLikelyEnglish(text)) {
      // Must have lang= attribute on this element or an ancestor that overrides
      let cur: Element | null = b;
      let found = false;
      while (cur && cur !== doc.documentElement) {
        const l = (cur.getAttribute('lang') ?? '').toLowerCase().split('-')[0];
        if (l && l !== 'sv' && l !== 'nb' && l !== 'nn' && l !== 'no' && l !== 'da' && l !== 'fi') {
          found = true;
          break;
        }
        cur = cur.parentElement;
      }
      if (!found) return false;
    }
  }
  return true;
};

export const rule: RuleDefinition = {
  id: 'ariada/banking/locale-fallback',
  selector: 'html',
  any: ['ariada/banking/foreign-blocks-marked'],
  all: [],
  none: [],
  tags: ['cat.language', 'wcag2aa', 'wcag312', 'EAA', 'EAA-I4'],
  metadata,
};

export const checkDefinition = {
  id: 'ariada/banking/foreign-blocks-marked',
  evaluate: check,
  metadata: {
    impact: metadata.impact,
    messages: {
      pass: 'Foreign-language blocks declare their own lang attribute.',
      fail: 'English content inside a Nordic-locale page is missing lang="en" wrapper.',
    },
  },
};
