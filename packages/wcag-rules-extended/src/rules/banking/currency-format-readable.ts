// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
/**
 * Rule: ariada/banking/currency-format-readable
 *
 * When displaying currency amounts in a programmatic context (transaction
 * lists, balances), the markup MUST distinguish the integer-part /
 * decimal-part / currency-symbol so that locale-specific formatting
 * (Swedish "1 234,56 kr" vs US "$1,234.56") doesn't confuse screen readers.
 *
 * Acceptable patterns:
 *   1. Native `<output>` element with locale-aware Intl formatting, OR
 *   2. `<data value="1234.56">` (HTML <data> with machine-readable value), OR
 *   3. ARIA `aria-label` with disambiguated form (e.g. "1 thousand 234 kronor 56").
 *
 * Heuristic: any element with class containing `price|amount|balance|saldo`
 * AND text containing two consecutive digits but NO `<data value>` /
 * `<output>` / `aria-label` is flagged.
 *
 * WCAG SC: 1.3.1 Info and Relationships, 1.3.5 Identify Input Purpose.
 */

import type { CheckEvaluate, RuleDefinition, RuleMetadata } from '../../types.js';

const HELP_URL =
  'https://github.com/ariada-org/ariada/blob/main/packages/wcag-rules-extended/docs/rules/banking-currency-format-readable.md';

export const metadata: RuleMetadata = {
  description: 'Currency amounts should use <data>, <output>, or aria-label for screen readers.',
  help: 'Wrap currency in <data value="1234.56">1 234,56 kr</data> or use aria-label.',
  helpUrl: HELP_URL,
  wcag: ['1.3.1'],
  en301549: ['9.1.3.1'],
  eaaAnnexI: ['I.4'],
  impact: 'minor',
};

function looksLikeCurrencyDisplay(node: Element): boolean {
  const cls = node.getAttribute('class') ?? '';
  const id = node.getAttribute('id') ?? '';
  const dataRole = node.getAttribute('data-role') ?? '';
  if (!/\b(price|amount|balance|saldo|belopp|summa|sum|kontonr)\b/i.test(`${cls} ${id} ${dataRole}`))
    return false;
  // Element should be a leaf-ish element with currency text
  const text = (node.textContent ?? '').trim();
  // Must contain at least one digit and a currency symbol or token
  return /\d/.test(text) && /(\d[\s.,]\d|kr|sek|eur|€|\$|£|nok|dkk|kruunua)/i.test(text);
}

export const check: CheckEvaluate = (node) => {
  if (!looksLikeCurrencyDisplay(node)) return true;
  const tag = node.tagName.toLowerCase();
  if (tag === 'data' && node.getAttribute('value')) return true;
  if (tag === 'output') return true;
  if ((node.getAttribute('aria-label') ?? '').trim()) return true;
  // Or descendant <data> / <output>
  if (node.querySelector('data[value], output')) return true;
  return false;
};

export const rule: RuleDefinition = {
  id: 'ariada/banking/currency-format-readable',
  // CSS selector intentionally case-sensitive (axe-core's internal selector
  // parser rejects the CSS-L4 `... i` flag with "Expected ']' but 'i' found").
  // Broaden the CSS pre-filter and rely on `matches:` (runtime regex) for the
  // case-insensitive narrowing — `looksLikeCurrencyDisplay` already does /…/i.
  selector: '[class], [id], [data-role]',
  matches: looksLikeCurrencyDisplay,
  any: ['ariada/banking/currency-has-machine-readable-form'],
  all: [],
  none: [],
  tags: ['cat.semantics', 'wcag2a', 'wcag131', 'EAA', 'EAA-I4'],
  metadata,
};

export const checkDefinition = {
  id: 'ariada/banking/currency-has-machine-readable-form',
  evaluate: check,
  metadata: {
    impact: metadata.impact,
    messages: {
      pass: 'Currency display uses <data>, <output>, or aria-label.',
      fail: 'Currency display is plain text — Nordic format "1 234,56 kr" may be mis-read by screen readers.',
    },
  },
};
