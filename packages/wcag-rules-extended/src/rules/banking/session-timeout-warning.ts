// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
/**
 * Rule: ariada/banking/session-timeout-warning
 *
 * Banking pages with a session-timeout dialog/notification MUST give users
 * sufficient time to react. WCAG 2.2.1 Timing Adjustable requires either:
 *   - User can disable the time-out, OR
 *   - User can extend the time-out by at least 10x default, OR
 *   - User is warned ≥20 seconds before timeout AND can extend by simple action.
 *
 * This rule checks for the warning-pattern existence — presence of a
 * timeout warning element (typically `role="alertdialog"` or with class
 * containing `timeout|inactivity`) with a button to extend.
 *
 * WCAG SC: 2.2.1 Timing Adjustable (Level A).
 * EN 301 549 v3.2.1: 9.2.2.1.
 * EAA Annex I §I.4.
 */

import { getAccessibleNameLite } from '../../helpers.js';
import type { CheckEvaluate, RuleDefinition, RuleMetadata } from '../../types.js';

const HELP_URL =
  'https://github.com/ariada-org/ariada/blob/main/packages/wcag-rules-extended/docs/rules/banking-session-timeout-warning.md';

export const metadata: RuleMetadata = {
  description: 'Session timeout dialogs must offer an extend / continue option.',
  help: 'Add an "Extend session" button inside the timeout warning dialog.',
  helpUrl: HELP_URL,
  wcag: ['2.2.1'],
  en301549: ['9.2.2.1'],
  eaaAnnexI: ['I.4'],
  impact: 'serious',
};

function looksLikeTimeoutWarning(node: Element): boolean {
  const role = node.getAttribute('role');
  const cls = node.getAttribute('class') ?? '';
  const idAttribute = node.getAttribute('id') ?? '';
  if (role === 'alertdialog' || role === 'dialog') {
    return /timeout|inactivity|session|expire|utgång|utløp|umpeutu/i.test(`${cls} ${idAttribute}`);
  }
  return /\b(timeout|inactivity|session-warning|expire-warning|utgangs|utløps|umpeutumis)\b/i.test(
    `${cls} ${idAttribute}`,
  );
}

const EXTEND_TEXT_RE =
  /\b(extend|continue|stay\s+(signed|logged)|forlæng|fortsætt|fortsätt|fortsett|jatka|pidennä|pid[eé]nn[aä])/i;

export const check: CheckEvaluate = (node) => {
  if (!looksLikeTimeoutWarning(node)) return true;
  const buttons = node.querySelectorAll('button, [role="button"], a[href], input[type="submit"]');
  for (const b of Array.from(buttons)) {
    const name = getAccessibleNameLite(b);
    if (EXTEND_TEXT_RE.test(name)) return true;
  }
  return false;
};

export const rule: RuleDefinition = {
  id: 'ariada/banking/session-timeout-warning',
  // CSS selector intentionally case-sensitive (axe-core's internal selector
  // parser rejects the CSS-L4 `... i` flag with "Expected ']' but 'i' found").
  // Broaden the CSS pre-filter and rely on `matches:` (runtime regex) for the
  // case-insensitive narrowing — `looksLikeTimeoutWarning` already does /…/i.
  selector: '[role="alertdialog"], [role="dialog"], [class], [id]',
  matches: looksLikeTimeoutWarning,
  any: ['ariada/banking/timeout-has-extend-button'],
  all: [],
  none: [],
  tags: ['cat.time-and-media', 'wcag2a', 'wcag221', 'EAA', 'EAA-I4'],
  metadata,
};

export const checkDefinition = {
  id: 'ariada/banking/timeout-has-extend-button',
  evaluate: check,
  metadata: {
    impact: metadata.impact,
    messages: {
      pass: 'Timeout warning provides an extend / continue action.',
      fail: 'Timeout warning has no button to extend session — WCAG 2.2.1 violated.',
    },
  },
};
