// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
/**
 * Rule: ariada/transport/seat-selection-has-accessible-name
 *
 * A seat control inside an interactive seat map (`data-seat-map`) — a
 * `<button>`, a `role="button"`, or a checkbox/radio `<input>` — must have an
 * accessible name that identifies its seat (e.g. "12A"). A seat control with
 * no name reads as a bare "button" with no seat identity, so a screen-reader
 * traveller cannot tell which seat they are about to book.
 *
 * WCAG SC: 4.1.2 Name, Role, Value (Level A).
 */

import { getAccessibleNameLite } from '../../helpers.js';
import type { CheckEvaluate, RuleDefinition, RuleMetadata } from '../../types.js';

const HELP_URL =
  'https://github.com/ariada-org/ariada/blob/main/packages/wcag-rules-extended/docs/rules/transport-seat-selection-has-accessible-name.md';

export const metadata: RuleMetadata = {
  description: 'Seat-map controls must have an accessible name identifying the seat.',
  help: 'Give each seat control a label, text, aria-label, or title naming the seat.',
  helpUrl: HELP_URL,
  wcag: ['4.1.2'],
  en301549: ['9.4.1.2'],
  eaaAnnexI: ['I.7'],
  impact: 'serious',
};

function looksLikeSeatControl(node: Element): boolean {
  if (node.closest('[data-seat-map]') === null) return false;
  const tag = node.tagName.toLowerCase();
  if (tag === 'button') return true;
  if ((node.getAttribute('role') ?? '').trim().toLowerCase() === 'button') return true;
  if (tag === 'input') {
    const type = (node.getAttribute('type') ?? 'text').toLowerCase();
    return type === 'checkbox' || type === 'radio';
  }
  return false;
}

export const check: CheckEvaluate = (node) => {
  if (!looksLikeSeatControl(node)) return true;
  // getAccessibleNameLite resolves the standard name sources (text content,
  // aria-label, aria-labelledby, title). The `value` attribute is intentionally
  // NOT accepted as a fallback: per HTML accessibility mapping a checkbox/radio
  // derives its name from a label, not its value, so a `value="12A"` with no
  // label is a genuine violation a screen-reader user would hit.
  return getAccessibleNameLite(node).trim().length > 0;
};

export const rule: RuleDefinition = {
  id: 'ariada/transport/seat-selection-has-accessible-name',
  selector: '[data-seat-map] button, [data-seat-map] [role="button"], [data-seat-map] input',
  matches: looksLikeSeatControl,
  any: ['ariada/transport/seat-control-has-name'],
  all: [],
  none: [],
  tags: ['cat.aria', 'wcag2a', 'wcag412', 'EAA', 'EAA-I7'],
  metadata,
};

export const checkDefinition = {
  id: 'ariada/transport/seat-control-has-name',
  evaluate: check,
  metadata: {
    impact: metadata.impact,
    messages: {
      pass: 'Seat-map control has an accessible name identifying the seat.',
      fail: 'Seat-map control has no accessible name, so it reads as a bare "button".',
    },
  },
};
