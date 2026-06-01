// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
/**
 * Rule: ariada/ebooks/text-spacing-overridable
 *
 * Reading surfaces must let users override line, letter, and word spacing via
 * a custom stylesheet (a bookmarklet or browser-injected sheet readers with
 * dyslexia or low vision rely on). Inline styles that set `line-height`,
 * `letter-spacing`, or `word-spacing` with `!important` win over a user
 * stylesheet's normal-priority declarations, locking the reader out of the
 * spacing adjustments WCAG 1.4.12 guarantees.
 *
 * WCAG SC: 1.4.12 Text Spacing (Level AA).
 */

import type { CheckEvaluate, RuleDefinition, RuleMetadata } from '../../types.js';

const HELP_URL =
  'https://github.com/ariada-org/ariada/blob/main/packages/wcag-rules-extended/docs/rules/ebooks-text-spacing-overridable.md';

export const metadata: RuleMetadata = {
  description: 'Inline text-spacing styles must not use !important (blocks user overrides).',
  help: 'Remove !important from inline line-height / letter-spacing / word-spacing.',
  helpUrl: HELP_URL,
  wcag: ['1.4.12'],
  en301549: ['9.1.4.12'],
  eaaAnnexI: ['I.5'],
  impact: 'serious',
};

/** Spacing properties WCAG 1.4.12 expects users to be able to override. */
const SPACING_PROPERTIES = ['line-height', 'letter-spacing', 'word-spacing'];

function looksLikeTextBlock(node: Element): boolean {
  const style = node.getAttribute('style');
  if (!style) return false;
  const lower = style.toLowerCase();
  return SPACING_PROPERTIES.some((property) => lower.includes(property));
}

/**
 * Split an inline `style` string into individual `{ property, value }`
 * declarations. Each declaration is split on its FIRST colon only, so values
 * that themselves contain a colon (e.g. a `url()`) survive intact. Property
 * names and values are lower-cased; declarations without a colon are skipped.
 */
function parseDeclarations(style: string): { property: string; value: string }[] {
  const declarations: { property: string; value: string }[] = [];
  for (const part of style.split(';')) {
    const colon = part.indexOf(':');
    if (colon === -1) continue;
    const property = part.slice(0, colon).trim().toLowerCase();
    const value = part.slice(colon + 1).trim().toLowerCase();
    if (property) declarations.push({ property, value });
  }
  return declarations;
}

// `!important`, tolerating whitespace between the bang and the keyword.
const IMPORTANT_RE = /!\s*important/;

export const check: CheckEvaluate = (node) => {
  if (!looksLikeTextBlock(node)) return true;
  const style = node.getAttribute('style') ?? '';
  for (const { property, value } of parseDeclarations(style)) {
    if (SPACING_PROPERTIES.includes(property) && IMPORTANT_RE.test(value)) {
      return false;
    }
  }
  return true;
};

export const rule: RuleDefinition = {
  id: 'ariada/ebooks/text-spacing-overridable',
  selector: '[style]',
  matches: looksLikeTextBlock,
  any: ['ariada/ebooks/text-spacing-not-locked'],
  all: [],
  none: [],
  tags: ['cat.text', 'wcag2aa', 'wcag1412', 'EAA', 'EAA-I5'],
  metadata,
};

export const checkDefinition = {
  id: 'ariada/ebooks/text-spacing-not-locked',
  evaluate: check,
  metadata: {
    impact: metadata.impact,
    messages: {
      pass: 'Inline text spacing can be overridden by a user stylesheet.',
      fail: 'Inline line-height / letter-spacing / word-spacing uses !important, blocking user overrides.',
    },
  },
};
