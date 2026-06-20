// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
/**
 * Rule: ariada/banking/transaction-amount-input
 *
 * Amount-input fields in banking flows MUST declare both:
 *   - `inputmode="decimal"` (or `numeric`) for mobile soft keyboard, AND
 *   - currency context via `aria-label` mentioning currency or a sibling
 *     element with currency symbol referenced by `aria-describedby`.
 *
 * Without the currency context, screen reader users hear "12.50" without
 * knowing if it's SEK, EUR, USD.
 *
 * WCAG SC: 1.3.5 Identify Input Purpose (Level AA), 3.3.2 Labels (Level A).
 * EN 301 549 v3.2.1: 9.1.3.5, 9.3.3.2.
 * EAA Annex I §I.4.
 */

import { getAccessibleNameLite } from '../../helpers.js';
import type { CheckEvaluate, RuleDefinition, RuleMetadata } from '../../types.js';

const HELP_URL =
  'https://github.com/ariada-org/ariada/blob/main/packages/wcag-rules-extended/docs/rules/banking-transaction-amount-input.md';

export const metadata: RuleMetadata = {
  description: 'Banking amount inputs must declare inputmode and currency context.',
  help: 'Add inputmode="decimal" and include currency in label (e.g. "Amount in SEK").',
  helpUrl: HELP_URL,
  wcag: ['1.3.5', '3.3.2'],
  en301549: ['9.1.3.5', '9.3.3.2'],
  eaaAnnexI: ['I.4'],
  impact: 'serious',
};

const CURRENCY_TOKEN_RE =
  /\b(sek|eur|usd|nok|dkk|fim|gbp|chf|kr|kronor|kronur|krone|€|\$|£|¥|kruunua|krooni)\b/i;

function looksLikeAmountInput(node: Element): boolean {
  if (node.tagName.toLowerCase() !== 'input') return false;
  const type = (node.getAttribute('type') ?? 'text').toLowerCase();
  if (!['text', 'number', 'tel'].includes(type)) return false;
  const name = node.getAttribute('name') ?? '';
  const id = node.getAttribute('id') ?? '';
  const label = getAccessibleNameLite(node);
  return /\b(amount|sum|belopp|summa|beløp|sumar|määrä|summa|betra|bel[oö]b)\b/i.test(
    `${name} ${id} ${label}`,
  );
}

export const check: CheckEvaluate = (node) => {
  if (!looksLikeAmountInput(node)) return true;
  const inputmode = (node.getAttribute('inputmode') ?? '').toLowerCase();
  const hasInputmode =
    inputmode === 'decimal' ||
    inputmode === 'numeric' ||
    (node.getAttribute('type') ?? '').toLowerCase() === 'number';
  if (!hasInputmode) return false;

  // Currency context check
  const accumulatorName = getAccessibleNameLite(node);
  if (CURRENCY_TOKEN_RE.test(accumulatorName)) return true;

  // Also accept a described-by region that mentions currency
  const descBy = node.getAttribute('aria-describedby');
  if (descBy) {
    const document = node.ownerDocument;
    const ids = descBy.split(/\s+/).filter(Boolean);
    for (const id of ids) {
      const ref = document.getElementById(id);
      if (ref && CURRENCY_TOKEN_RE.test(ref.textContent ?? '')) return true;
    }
  }
  return false;
};

export const rule: RuleDefinition = {
  id: 'ariada/banking/transaction-amount-input',
  selector: 'input',
  matches: looksLikeAmountInput,
  any: ['ariada/banking/amount-has-currency-context'],
  all: [],
  none: [],
  tags: ['cat.forms', 'wcag2a', 'wcag2aa', 'wcag135', 'wcag332', 'EAA', 'EAA-I4'],
  metadata,
};

export const checkDefinition = {
  id: 'ariada/banking/amount-has-currency-context',
  evaluate: check,
  metadata: {
    impact: metadata.impact,
    messages: {
      pass: 'Banking amount input has inputmode and currency context.',
      fail: 'Banking amount input is missing inputmode="decimal" or currency in label.',
    },
  },
};
