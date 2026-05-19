// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
/**
 * Rule: ariada/banking/2fa-keyboard-accessible
 *
 * Two-factor authentication code entry inputs (typically a row of single-
 * digit fields, e.g. `<input maxlength="1">` × 6) MUST be fully keyboard-
 * accessible: each input must be focusable AND must accept paste (no
 * `inputmode="none"`) AND must not trap focus on Tab.
 *
 * WCAG SC: 2.1.1 Keyboard (Level A).
 * EN 301 549 v3.2.1: 9.2.1.1.
 * EAA Annex I §I.4 (banking services).
 */

import type { CheckEvaluate, RuleDefinition, RuleMetadata } from '../../types.js';

const HELP_URL =
  'https://github.com/ariada-org/ariada/blob/main/packages/wcag-rules-extended/docs/rules/banking-2fa-keyboard-accessible.md';

export const metadata: RuleMetadata = {
  description: '2FA code entry inputs must be keyboard-focusable and accept paste.',
  help: 'Use real <input> elements (not <div contenteditable>) and avoid inputmode="none".',
  helpUrl: HELP_URL,
  wcag: ['2.1.1'],
  en301549: ['9.2.1.1'],
  eaaAnnexI: ['I.4'],
  impact: 'critical',
};

function looksLike2faInput(node: Element): boolean {
  const tag = node.tagName.toLowerCase();
  if (tag !== 'input') return false;
  const type = (node.getAttribute('type') ?? 'text').toLowerCase();
  if (!['text', 'tel', 'number'].includes(type)) return false;
  const ml = node.getAttribute('maxlength');
  if (ml !== '1') return false;
  // Check there are siblings of the same maxlength=1 pattern (indicating a code-entry row)
  const parent = node.parentElement;
  if (!parent) return false;
  const siblings = parent.querySelectorAll('input[maxlength="1"]');
  return siblings.length >= 3;
}

export const check: CheckEvaluate = (node) => {
  if (!looksLike2faInput(node)) return true;
  // Must not have inputmode="none" (which disables soft keyboard but also blocks paste on some clients)
  const inputmode = (node.getAttribute('inputmode') ?? '').toLowerCase();
  if (inputmode === 'none') return false;
  // Must not have tabindex=-1 (would skip in tab order)
  const ti = node.getAttribute('tabindex');
  if (ti === '-1') return false;
  // Must not be readonly (would defeat input purpose)
  if (node.hasAttribute('readonly')) return false;
  return true;
};

export const rule: RuleDefinition = {
  id: 'ariada/banking/2fa-keyboard-accessible',
  selector: 'input[maxlength="1"]',
  matches: looksLike2faInput,
  any: ['ariada/banking/2fa-input-is-keyboard-ok'],
  all: [],
  none: [],
  tags: ['cat.keyboard', 'wcag2a', 'wcag211', 'EAA', 'EAA-I4'],
  metadata,
};

export const checkDefinition = {
  id: 'ariada/banking/2fa-input-is-keyboard-ok',
  evaluate: check,
  metadata: {
    impact: metadata.impact,
    messages: {
      pass: '2FA input is keyboard-accessible.',
      fail: '2FA input has tabindex=-1, readonly, or inputmode="none" — keyboard users blocked.',
    },
  },
};
