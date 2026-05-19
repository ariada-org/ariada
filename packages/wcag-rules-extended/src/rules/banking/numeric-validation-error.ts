// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
/**
 * Rule: ariada/banking/numeric-validation-error-locale
 *
 * Numeric / amount validation errors (e.g. "Invalid amount") must be in the
 * page's locale language — not English. A Swedish-language banking page
 * should display "Ogiltigt belopp", not "Invalid amount".
 *
 * Heuristic: on a Nordic-locale page (lang=sv/nb/da/fi), search visible
 * error messages for English-only validation tokens (`invalid`, `required`,
 * `error`). If found AND the error message contains no Nordic-language
 * equivalent, fail.
 *
 * WCAG SC: 3.1.1 Language of Page (Level A), 3.3.1 Error Identification (A).
 */

import type { CheckEvaluate, RuleDefinition, RuleMetadata } from '../../types.js';

const HELP_URL =
  'https://github.com/ariada-org/ariada/blob/main/packages/wcag-rules-extended/docs/rules/banking-numeric-validation-error.md';

export const metadata: RuleMetadata = {
  description: 'Validation errors on Nordic-locale pages must be localised.',
  help: 'Translate validation messages to the page locale (sv/nb/da/fi).',
  helpUrl: HELP_URL,
  wcag: ['3.1.1', '3.3.1'],
  en301549: ['9.3.1.1', '9.3.3.1'],
  eaaAnnexI: ['I.4'],
  impact: 'moderate',
};

const NORDIC_LANGS = new Set(['sv', 'nb', 'nn', 'no', 'da', 'fi']);

const EN_ONLY_TOKENS =
  /\b(invalid|required|error|please\s+enter|field\s+is\s+empty|too\s+(short|long))\b/i;

const NORDIC_VALIDATION_TOKENS =
  /\b(ogiltig|fel|kr[äa]vs|m[åa]ste|fyll|ange|pakollinen|virhe|virheellinen|sy[oö]tt[äa]|p[äa]katu|t[äa]ytt[aä]|forkert|udfyld|fylles|ugyldig|p[åa]krevd)\b/i;

export const check: CheckEvaluate = (node) => {
  const doc = node.ownerDocument;
  const lang = (doc.documentElement.getAttribute('lang') ?? '').toLowerCase().split('-')[0];
  if (!NORDIC_LANGS.has(lang || '')) return true;

  const errorElements = doc.querySelectorAll(
    '[role="alert"], [class*="error" i], [class*="invalid" i], [aria-invalid="true"]',
  );
  for (const el of Array.from(errorElements)) {
    const text = (el.textContent ?? '').trim();
    if (!text) continue;
    if (EN_ONLY_TOKENS.test(text) && !NORDIC_VALIDATION_TOKENS.test(text)) {
      return false;
    }
  }
  return true;
};

export const rule: RuleDefinition = {
  id: 'ariada/banking/numeric-validation-error-locale',
  selector: 'html',
  any: ['ariada/banking/validation-errors-localised'],
  all: [],
  none: [],
  tags: ['cat.language', 'wcag2a', 'wcag311', 'wcag331', 'EAA', 'EAA-I4'],
  metadata,
};

export const checkDefinition = {
  id: 'ariada/banking/validation-errors-localised',
  evaluate: check,
  metadata: {
    impact: metadata.impact,
    messages: {
      pass: 'Validation error messages are in the page locale.',
      fail: 'Validation error messages are in English on a Nordic-locale page.',
    },
  },
};
