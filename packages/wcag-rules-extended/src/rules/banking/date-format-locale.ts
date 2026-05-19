// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
/**
 * Rule: ariada/banking/date-format-locale
 *
 * Date inputs in banking flows should use `<input type="date">` (which
 * delegates locale handling to the browser) OR if a text input is used,
 * it MUST include an explicit format hint in the label / placeholder /
 * aria-describedby (e.g. "YYYY-MM-DD").
 *
 * Ambiguous date formats are a common Nordic-locale failure — "01/02/2026"
 * is January 2 in US format, February 1 in EU format.
 *
 * WCAG SC: 1.3.5 Identify Input Purpose (Level AA), 3.3.2 Labels (Level A).
 */

import { getAccessibleNameLite } from '../../helpers.js';
import type { CheckEvaluate, RuleDefinition, RuleMetadata } from '../../types.js';

const HELP_URL =
  'https://github.com/ariada-org/ariada/blob/main/packages/wcag-rules-extended/docs/rules/banking-date-format-locale.md';

export const metadata: RuleMetadata = {
  description: 'Banking date inputs must use type="date" or declare explicit format.',
  help: 'Prefer <input type="date">; else add placeholder/aria-describedby with "YYYY-MM-DD" hint.',
  helpUrl: HELP_URL,
  wcag: ['1.3.5', '3.3.2'],
  en301549: ['9.1.3.5', '9.3.3.2'],
  eaaAnnexI: ['I.4'],
  impact: 'moderate',
};

function looksLikeDateInput(node: Element): boolean {
  if (node.tagName.toLowerCase() !== 'input') return false;
  const type = (node.getAttribute('type') ?? 'text').toLowerCase();
  if (type === 'date') return false; // Handled natively — skip rule
  if (type !== 'text' && type !== 'tel') return false;
  const name = node.getAttribute('name') ?? '';
  const id = node.getAttribute('id') ?? '';
  const accName = getAccessibleNameLite(node);
  return /\b(date|datum|dato|p[äa]iv[äa]|due|payment[-_ ]?date|payday|maksupäivä)\b/i.test(
    `${name} ${id} ${accName}`,
  );
}

const FORMAT_HINT_RE =
  /(yyyy|åååå|vvvv)[-/.](mm)[-/.](dd|tt)|(dd|tt)[-/.]?(mm|kk)[-/.]?(yyyy|åååå|vvvv)/i;

export const check: CheckEvaluate = (node) => {
  if (!looksLikeDateInput(node)) return true;
  const placeholder = node.getAttribute('placeholder') ?? '';
  const accName = getAccessibleNameLite(node);
  const haystack = `${placeholder} ${accName}`;
  if (FORMAT_HINT_RE.test(haystack)) return true;

  // Also accept aria-describedby with format
  const desc = node.getAttribute('aria-describedby');
  if (desc) {
    const doc = node.ownerDocument;
    const ids = desc.split(/\s+/).filter(Boolean);
    for (const id of ids) {
      const ref = doc.getElementById(id);
      if (ref && FORMAT_HINT_RE.test(ref.textContent ?? '')) return true;
    }
  }
  return false;
};

export const rule: RuleDefinition = {
  id: 'ariada/banking/date-format-locale',
  selector: 'input',
  matches: looksLikeDateInput,
  any: ['ariada/banking/date-has-format-hint'],
  all: [],
  none: [],
  tags: ['cat.forms', 'wcag2a', 'wcag2aa', 'wcag135', 'wcag332', 'EAA', 'EAA-I4'],
  metadata,
};

export const checkDefinition = {
  id: 'ariada/banking/date-has-format-hint',
  evaluate: check,
  metadata: {
    impact: metadata.impact,
    messages: {
      pass: 'Date input declares format hint.',
      fail: 'Date input format is ambiguous — add type="date" or "YYYY-MM-DD" hint.',
    },
  },
};
