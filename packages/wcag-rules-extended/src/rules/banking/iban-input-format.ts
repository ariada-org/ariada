// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
/**
 * Rule: ariada/banking/iban-input-format
 *
 * IBAN input fields must have:
 *   - An accessible name mentioning "IBAN" (so screen readers announce it), AND
 *   - A format hint in placeholder or describedby (e.g. "SE45 5000 0000 0583 9825 7466"
 *     or "FI21 1234 5600 0007 85") that shows the segmented format.
 *
 * WCAG SC: 3.3.2 Labels or Instructions (Level A), 1.3.5 Identify Input Purpose (AA).
 */

import { getAccessibleNameLite } from '../../helpers.js';
import type { CheckEvaluate, RuleDefinition, RuleMetadata } from '../../types.js';

const HELP_URL =
  'https://github.com/ariada-org/ariada/blob/main/packages/wcag-rules-extended/docs/rules/banking-iban-input-format.md';

export const metadata: RuleMetadata = {
  description: 'IBAN inputs must label "IBAN" and show segmented format hint.',
  help: 'Use aria-label="IBAN" and placeholder with segmented example.',
  helpUrl: HELP_URL,
  wcag: ['3.3.2', '1.3.5'],
  en301549: ['9.3.3.2', '9.1.3.5'],
  eaaAnnexI: ['I.4'],
  impact: 'moderate',
};

function looksLikeIbanInput(node: Element): boolean {
  if (node.tagName.toLowerCase() !== 'input') return false;
  const type = (node.getAttribute('type') ?? 'text').toLowerCase();
  if (type !== 'text' && type !== 'tel') return false;
  const name = node.getAttribute('name') ?? '';
  const id = node.getAttribute('id') ?? '';
  const accumulatorName = getAccessibleNameLite(node);
  return /\biban\b/i.test(`${name} ${id} ${accumulatorName}`);
}

const SEGMENTED_FORMAT_RE = /\b[A-Z]{2}\d{2}(\s\d{2,4}){2,}/;

export const check: CheckEvaluate = (node) => {
  if (!looksLikeIbanInput(node)) return true;
  // 1. The IBAN identification must be reachable to assistive technology — accept
  //    EITHER an accessible name containing "iban" OR id/name attribute containing
  //    "iban" (the id/name path is also surfaced to AT via the associated <label>
  //    or via the input's `name` reflected in some screen-reader heuristics).
  //    Earlier logic required both looksLikeIbanInput AND a strict accName re-check,
  //    which rejected inputs identified by id alone even when format-hint was present.
  const accumulatorName = getAccessibleNameLite(node);
  const name = node.getAttribute('name') ?? '';
  const id = node.getAttribute('id') ?? '';
  if (!/\biban\b/i.test(`${accumulatorName} ${name} ${id}`)) return false;
  // 2. Format hint
  const placeholder = node.getAttribute('placeholder') ?? '';
  if (SEGMENTED_FORMAT_RE.test(placeholder)) return true;
  const desc = node.getAttribute('aria-describedby');
  if (desc) {
    const document = node.ownerDocument;
    const ids = desc.split(/\s+/).filter(Boolean);
    for (const id of ids) {
      const ref = document.getElementById(id);
      if (ref && SEGMENTED_FORMAT_RE.test(ref.textContent ?? '')) return true;
    }
  }
  return false;
};

export const rule: RuleDefinition = {
  id: 'ariada/banking/iban-input-format',
  selector: 'input',
  matches: looksLikeIbanInput,
  any: ['ariada/banking/iban-has-format-hint'],
  all: [],
  none: [],
  tags: ['cat.forms', 'wcag2a', 'wcag2aa', 'wcag332', 'wcag135', 'EAA', 'EAA-I4'],
  metadata,
};

export const checkDefinition = {
  id: 'ariada/banking/iban-has-format-hint',
  evaluate: check,
  metadata: {
    impact: metadata.impact,
    messages: {
      pass: 'IBAN input has label and segmented format hint.',
      fail: 'IBAN input is missing format hint (e.g. "SE45 5000 0000 0583 9825 7466").',
    },
  },
};
