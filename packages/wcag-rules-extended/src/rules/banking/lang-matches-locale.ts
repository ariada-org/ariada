// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
/**
 * Rule: ariada/banking/lang-matches-locale
 *
 * The `<html lang="...">` attribute MUST match the actual language of the
 * page content. For pages serving Nordic banking customers, a mismatch
 * (e.g. `lang="en"` but content is in Swedish) breaks screen-reader
 * pronunciation.
 *
 * This rule uses heuristic word-pattern detection per language: if the
 * page body contains ≥5 distinctive function words of a specific Nordic
 * language, the `lang` attribute must match.
 *
 * Nordic distinctive function words (high frequency, low cross-language ambiguity):
 *   sv: och, att, det, för, inte, men, jag, denna, eller, med
 *   nb: og, å, det, for, ikke, men, jeg, denne, eller, med, ikkje
 *   da: og, at, det, for, ikke, men, jeg, denne, eller, med
 *   fi: ja, on, ei, että, mutta, minä, tämä, tai, kanssa, ovat
 *
 * Nordic-script precondition (added 2026-05-15): the nb/da
 * function-word lists overlap heavily with English (`for`, `at`, `det`,
 * `med`), so on an English page with ~5 such tokens the rule fires
 * spuriously. We therefore require at least one occurrence of a
 * Nordic-specific character `[åøæäöÅØÆÄÖ]` somewhere in the document
 * text before considering any Nordic-language detection at all. If no
 * such character is present the page is treated as English-only and the
 * rule short-circuits to "rule inapplicable, no violation".
 *
 * WCAG SC: 3.1.1 Language of Page (Level A).
 * EN 301 549 v3.2.1: 9.3.1.1.
 */

import type { CheckEvaluate, RuleDefinition, RuleMetadata } from '../../types.js';

const HELP_URL =
  'https://github.com/ariada-org/ariada/blob/main/packages/wcag-rules-extended/docs/rules/banking-lang-matches-locale.md';

export const metadata: RuleMetadata = {
  description: 'Page <html lang="..."> must match actual content language.',
  help: 'Set lang="sv" for Swedish, lang="nb" or "nn" for Norwegian, lang="da" for Danish, lang="fi" for Finnish.',
  helpUrl: HELP_URL,
  wcag: ['3.1.1'],
  en301549: ['9.3.1.1'],
  eaaAnnexI: ['I.1', 'I.4'],
  impact: 'serious',
};

const SV_WORDS = ['och', 'att', 'det', 'för', 'inte', 'men', 'jag', 'denna', 'eller', 'med'];
const NB_WORDS = ['og', 'det', 'for', 'ikke', 'men', 'jeg', 'denne', 'eller', 'med', 'ikkje'];
const DA_WORDS = ['og', 'at', 'det', 'for', 'ikke', 'men', 'jeg', 'denne', 'eller', 'med'];
const FI_WORDS = ['ja', 'että', 'mutta', 'minä', 'tämä', 'kanssa', 'ovat', 'mitä', 'kuin', 'olla'];

function countMatches(text: string, words: string[]): number {
  const haystack = ` ${text.toLowerCase()} `;
  let n = 0;
  for (const w of words) {
    const re = new RegExp(`\\s${w}\\s`, 'g');
    const m = haystack.match(re);
    if (m) n += m.length;
  }
  return n;
}

const THRESHOLD = 5;

// Any single occurrence of one of these characters is sufficient evidence that
// the page contains real Nordic-language text rather than English content with
// incidental function-word overlap. See BUG-2 in the 2026-05-15 cross-tool
// audit memo for the failure mode this gate prevents.
const NORDIC_SCRIPT_RE = /[åøæäöÅØÆÄÖ]/;

function hasNordicScript(text: string): boolean {
  return NORDIC_SCRIPT_RE.test(text);
}

function detectLanguage(text: string): 'sv' | 'nb' | 'da' | 'fi' | null {
  const counts: Record<string, number> = {
    sv: countMatches(text, SV_WORDS),
    nb: countMatches(text, NB_WORDS),
    da: countMatches(text, DA_WORDS),
    fi: countMatches(text, FI_WORDS),
  };
  const max = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  if (!max) return null;
  if (max[1] < THRESHOLD) return null;
  return max[0] as 'sv' | 'nb' | 'da' | 'fi';
}

export const check: CheckEvaluate = (node) => {
  const document = node.ownerDocument;
  const text = document.body?.textContent ?? '';
  // Nordic-script gate: if no å/ø/æ/ä/ö anywhere in the document text, the
  // page is overwhelmingly likely to be English and the function-word
  // detector's nb/da false-positive risk is too high. Skip the rule.
  if (!hasNordicScript(text)) return true;
  const detected = detectLanguage(text);
  if (!detected) return true; // Not enough signal — defer to upstream `html-has-lang`
  const declared = (document.documentElement.getAttribute('lang') ?? '').toLowerCase().split('-')[0];
  if (!declared) return false;
  // Accept nb / nn / no as equivalent
  if (detected === 'nb' && ['nb', 'nn', 'no'].includes(declared)) return true;
  return declared === detected;
};

export const rule: RuleDefinition = {
  id: 'ariada/banking/lang-matches-locale',
  selector: 'html',
  any: ['ariada/banking/lang-matches'],
  all: [],
  none: [],
  tags: ['cat.language', 'wcag2a', 'wcag311', 'EAA', 'EAA-I1'],
  metadata,
};

export const checkDefinition = {
  id: 'ariada/banking/lang-matches',
  evaluate: check,
  metadata: {
    impact: metadata.impact,
    messages: {
      pass: 'Page lang attribute matches actual content language.',
      fail: 'Page lang attribute does not match detected content language — screen reader will mispronounce.',
    },
  },
};
