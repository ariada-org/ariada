// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
/**
 * Rule: ariada/banking/login-error-not-blocking
 *
 * Bank login error messages must not block focus or trap users in a state
 * where they cannot retry. Specifically, an error message must either:
 *   - Use a `role="alert"` (auto-announces, doesn't trap), OR
 *   - Be in a region with `aria-live="polite"` or `"assertive"`.
 *
 * AND the login input that failed validation must NOT have `disabled`
 * attribute (which would lock the user out of fixing the error).
 *
 * WCAG SC: 3.3.1 Error Identification (Level A), 2.1.2 No Keyboard Trap (Level A).
 */

import type { CheckEvaluate, RuleDefinition, RuleMetadata } from '../../types.js';

const HELP_URL =
  'https://github.com/ariada-org/ariada/blob/main/packages/wcag-rules-extended/docs/rules/banking-login-error-not-blocking.md';

export const metadata: RuleMetadata = {
  description: 'Bank login errors must be announceable and must not lock input fields.',
  help: 'Use role="alert" on error; do not disable login inputs after failed attempt.',
  helpUrl: HELP_URL,
  wcag: ['3.3.1', '2.1.2'],
  en301549: ['9.3.3.1', '9.2.1.2'],
  eaaAnnexI: ['I.4'],
  impact: 'serious',
};

function isBankLoginContext(doc: Document): boolean {
  const url = doc.documentURI ?? '';
  if (/\/(login|signin|sign-in|bank|internetbank|nettbank|verkkopankki)/i.test(url)) return true;
  const title = doc.title ?? '';
  return /\b(log\s*in|sign\s*in|internetbank|nettbank|verkkopankki|kirjautuminen)\b/i.test(title);
}

export const check: CheckEvaluate = (node) => {
  const doc = node.ownerDocument;
  if (!isBankLoginContext(doc)) return true;
  // Find error messages with content
  const errs = doc.querySelectorAll(
    '[class*="error" i], [aria-invalid="true"] + [class*="message" i], [role="alert"]',
  );
  for (const e of Array.from(errs)) {
    const text = (e.textContent ?? '').trim();
    if (!text) continue;
    const role = e.getAttribute('role');
    const live = e.getAttribute('aria-live');
    const ancestor = e.closest('[aria-live], [role="status"], [role="alert"]');
    if (role !== 'alert' && live !== 'polite' && live !== 'assertive' && !ancestor) {
      return false;
    }
  }
  // Login inputs must not be disabled
  const inputs = doc.querySelectorAll('input[type="text"], input[type="password"], input[name*="user" i], input[name*="login" i]');
  for (const i of Array.from(inputs)) {
    if (i.hasAttribute('disabled')) return false;
  }
  return true;
};

export const rule: RuleDefinition = {
  id: 'ariada/banking/login-error-not-blocking',
  selector: 'html',
  any: ['ariada/banking/login-error-is-announceable'],
  all: [],
  none: [],
  tags: ['cat.forms', 'wcag2a', 'wcag331', 'wcag212', 'EAA', 'EAA-I4'],
  metadata,
};

export const checkDefinition = {
  id: 'ariada/banking/login-error-is-announceable',
  evaluate: check,
  metadata: {
    impact: metadata.impact,
    messages: {
      pass: 'Bank login error is announceable and inputs are not disabled.',
      fail: 'Bank login error lacks role=alert / live region, or inputs are disabled.',
    },
  },
};
