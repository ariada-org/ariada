// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
/**
 * Rule: ariada/transport/timetable-has-header-cells
 *
 * A transport timetable (a departures/arrivals grid) marked up with a
 * `<table data-timetable>` must contain at least one `<th>` header cell.
 * Without header cells a screen reader announces every value as an
 * undifferentiated data cell, so a traveller cannot tell which column is the
 * departure time, which is the platform, or which is the destination. The
 * grid becomes unnavigable.
 *
 * WCAG SC: 1.3.1 Info and Relationships (Level A).
 */

import type { CheckEvaluate, RuleDefinition, RuleMetadata } from '../../types.js';

const HELP_URL =
  'https://github.com/ariada-org/ariada/blob/main/packages/wcag-rules-extended/docs/rules/transport-timetable-has-header-cells.md';

export const metadata: RuleMetadata = {
  description: 'Timetable tables must declare header cells so rows and columns are navigable.',
  help: 'Add <th> header cells (with scope) to the departures/arrivals grid.',
  helpUrl: HELP_URL,
  wcag: ['1.3.1'],
  en301549: ['9.1.3.1'],
  eaaAnnexI: ['I.7'],
  impact: 'serious',
};

function looksLikeTimetable(node: Element): boolean {
  return node.tagName.toLowerCase() === 'table' && node.hasAttribute('data-timetable');
}

export const check: CheckEvaluate = (node) => {
  if (!looksLikeTimetable(node)) return true;
  // A departures/arrivals grid with no header cells is unnavigable by screen
  // reader. Count only header cells owned by THIS table — a `<th>` inside a
  // nested table must not satisfy the outer one.
  for (const th of node.querySelectorAll('th')) {
    if (th.closest('table') === node) return true;
  }
  return false;
};

export const rule: RuleDefinition = {
  id: 'ariada/transport/timetable-has-header-cells',
  selector: 'table[data-timetable]',
  matches: looksLikeTimetable,
  any: ['ariada/transport/timetable-has-th'],
  all: [],
  none: [],
  tags: ['cat.tables', 'wcag2a', 'wcag131', 'EAA', 'EAA-I7'],
  metadata,
};

export const checkDefinition = {
  id: 'ariada/transport/timetable-has-th',
  evaluate: check,
  metadata: {
    impact: metadata.impact,
    messages: {
      pass: 'Timetable declares header cells for navigable rows and columns.',
      fail: 'Timetable has no <th> header cells, so the grid is unnavigable by screen reader.',
    },
  },
};
