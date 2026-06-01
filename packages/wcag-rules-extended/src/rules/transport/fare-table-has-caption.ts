// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
/**
 * Rule: ariada/transport/fare-table-has-caption
 *
 * A fare table (a price/fare matrix) marked up with `<table data-fare-table>`
 * must have a `<caption>` child with non-empty text. The caption tells a
 * screen-reader traveller what the grid of prices represents (e.g. "Single
 * fares by zone") before they navigate into the cells; without it the matrix
 * of numbers has no announced context.
 *
 * WCAG SC: 1.3.1 Info and Relationships (Level A).
 */

import type { CheckEvaluate, RuleDefinition, RuleMetadata } from '../../types.js';

const HELP_URL =
  'https://github.com/ariada-org/ariada/blob/main/packages/wcag-rules-extended/docs/rules/transport-fare-table-has-caption.md';

export const metadata: RuleMetadata = {
  description: 'Fare tables must have a non-empty caption describing the price matrix.',
  help: 'Add a <caption> with text naming what the fare grid represents.',
  helpUrl: HELP_URL,
  wcag: ['1.3.1'],
  en301549: ['9.1.3.1'],
  eaaAnnexI: ['I.7'],
  impact: 'moderate',
};

function looksLikeFareTable(node: Element): boolean {
  return node.tagName.toLowerCase() === 'table' && node.hasAttribute('data-fare-table');
}

export const check: CheckEvaluate = (node) => {
  if (!looksLikeFareTable(node)) return true;
  // A price/fare matrix needs a caption so screen-reader users know what the
  // grid represents. A `<caption>` is only valid as a direct child of its
  // `<table>`, so `:scope > caption` matches this table's own caption and never
  // a nested table's.
  const caption = node.querySelector(':scope > caption');
  if (!caption) return false;
  return (caption.textContent ?? '').trim().length > 0;
};

export const rule: RuleDefinition = {
  id: 'ariada/transport/fare-table-has-caption',
  selector: 'table[data-fare-table]',
  matches: looksLikeFareTable,
  any: ['ariada/transport/fare-table-captioned'],
  all: [],
  none: [],
  tags: ['cat.tables', 'wcag2a', 'wcag131', 'EAA', 'EAA-I7'],
  metadata,
};

export const checkDefinition = {
  id: 'ariada/transport/fare-table-captioned',
  evaluate: check,
  metadata: {
    impact: metadata.impact,
    messages: {
      pass: 'Fare table has a non-empty caption describing the price matrix.',
      fail: 'Fare table has no non-empty <caption>, so the price grid lacks announced context.',
    },
  },
};
