// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
/**
 * Rule: ariada/transport/live-status-has-live-region
 *
 * A live transport status surface (a departures board or delay notice that
 * updates without a page reload) marked up with `data-live-status` must be an
 * ARIA live region so the update is announced to assistive technology. It must
 * carry EITHER `aria-live="polite"` / `aria-live="assertive"`, OR
 * `role="status"` / `role="alert"`. Without one of those a sighted user sees
 * the board flip to "Delayed" while a screen-reader user hears nothing.
 *
 * WCAG SC: 4.1.3 Status Messages (Level AA).
 */

import type { CheckEvaluate, RuleDefinition, RuleMetadata } from '../../types.js';

const HELP_URL =
  'https://github.com/ariada-org/ariada/blob/main/packages/wcag-rules-extended/docs/rules/transport-live-status-has-live-region.md';

export const metadata: RuleMetadata = {
  description: 'Live departures/delay surfaces must be an ARIA live region so updates announce.',
  help: 'Add aria-live="polite"/"assertive" or role="status"/"alert".',
  helpUrl: HELP_URL,
  wcag: ['4.1.3'],
  en301549: ['9.4.1.3'],
  eaaAnnexI: ['I.7'],
  impact: 'serious',
};

function looksLikeLiveStatus(node: Element): boolean {
  return node.hasAttribute('data-live-status');
}

export const check: CheckEvaluate = (node) => {
  if (!looksLikeLiveStatus(node)) return true;
  // aria-live=off does not announce, so it does not satisfy 4.1.3.
  const ariaLive = (node.getAttribute('aria-live') ?? '').trim().toLowerCase();
  if (ariaLive === 'polite' || ariaLive === 'assertive') return true;
  const role = (node.getAttribute('role') ?? '').trim().toLowerCase();
  if (role === 'status' || role === 'alert') return true;
  return false;
};

export const rule: RuleDefinition = {
  id: 'ariada/transport/live-status-has-live-region',
  selector: '[data-live-status]',
  matches: looksLikeLiveStatus,
  any: ['ariada/transport/live-status-is-live-region'],
  all: [],
  none: [],
  tags: ['cat.aria', 'wcag2aa', 'wcag413', 'EAA', 'EAA-I7'],
  metadata,
};

export const checkDefinition = {
  id: 'ariada/transport/live-status-is-live-region',
  evaluate: check,
  metadata: {
    impact: metadata.impact,
    messages: {
      pass: 'Live status surface is an ARIA live region, so updates are announced.',
      fail: 'Live status surface has no aria-live or role=status/alert, so updates are silent to AT.',
    },
  },
};
