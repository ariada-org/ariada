// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
/**
 * Rule: ariada/transport/booking-timeout-has-warning
 *
 * A booking hold timer (a "your seats are held for N minutes" countdown)
 * marked up with `data-booking-timeout` must give the traveller a way to be
 * warned about, and to extend, the time limit. It must carry EITHER an
 * `aria-describedby` pointing to a non-empty element that describes the limit,
 * OR a `data-timeout-warning` attribute that the application wires an "extend
 * time" control to. Without one of those a user who needs more time loses
 * their seats with no notice.
 *
 * WCAG SC: 2.2.1 Timing Adjustable (Level A).
 */

import type { CheckEvaluate, RuleDefinition, RuleMetadata } from '../../types.js';

const HELP_URL =
  'https://github.com/ariada-org/ariada/blob/main/packages/wcag-rules-extended/docs/rules/transport-booking-timeout-has-warning.md';

export const metadata: RuleMetadata = {
  description: 'Booking hold timers must offer a warning/extension mechanism.',
  help: 'Add aria-describedby to a non-empty warning, or a data-timeout-warning hook.',
  helpUrl: HELP_URL,
  wcag: ['2.2.1'],
  en301549: ['9.2.2.1'],
  eaaAnnexI: ['I.7'],
  impact: 'serious',
};

function looksLikeBookingTimer(node: Element): boolean {
  return node.hasAttribute('data-booking-timeout');
}

export const check: CheckEvaluate = (node) => {
  if (!looksLikeBookingTimer(node)) return true;
  // A data-timeout-warning hook is enough — the app wires an "extend time" control to it.
  if (node.hasAttribute('data-timeout-warning')) return true;
  // Otherwise require aria-describedby pointing to a non-empty element.
  const desc = node.getAttribute('aria-describedby');
  if (desc) {
    const document = node.ownerDocument;
    const ids = desc.split(/\s+/).filter(Boolean);
    for (const id of ids) {
      const ref = document.getElementById(id);
      if (ref && (ref.textContent ?? '').trim()) return true;
    }
  }
  return false;
};

export const rule: RuleDefinition = {
  id: 'ariada/transport/booking-timeout-has-warning',
  selector: '[data-booking-timeout]',
  matches: looksLikeBookingTimer,
  any: ['ariada/transport/booking-timeout-warns'],
  all: [],
  none: [],
  tags: ['cat.time-and-media', 'wcag2a', 'wcag221', 'EAA', 'EAA-I7'],
  metadata,
};

export const checkDefinition = {
  id: 'ariada/transport/booking-timeout-warns',
  evaluate: check,
  metadata: {
    impact: metadata.impact,
    messages: {
      pass: 'Booking hold timer offers a warning or extension mechanism.',
      fail: 'Booking hold timer has no warning/extension mechanism, so seats are lost without notice.',
    },
  },
};
