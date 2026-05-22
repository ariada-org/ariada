// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

import { z } from 'zod';

import { canonicalRuleId } from './explain-violation.js';
import { runListRules } from './list-rules.js';

/**
 * Input schema for the `ariada.suggest-fix` tool.
 */
export const suggestFixInputSchema = z.object({
  violationId: z.string().min(1),
  context: z
    .object({
      framework: z
        .enum(['html', 'react', 'vue', 'angular', 'svelte', 'solid'])
        .default('html')
        .optional(),
      snippet: z.string().optional(),
    })
    .optional(),
  locale: z.enum(['en', 'sv', 'nb', 'da', 'fi']).default('en').optional(),
});

/** Parsed input for the `ariada.suggest-fix` tool. */
export type SuggestFixInput = z.infer<typeof suggestFixInputSchema>;

/**
 * Confidence level on the returned pattern.
 */
export type FixConfidence = 'canonical' | 'adapted' | 'no-known-pattern';

/**
 * Output shape — always returns a `confidence` field. When
 * `no-known-pattern`, the server returns the fallback hint rather than
 * fabricating a snippet.
 */
export interface SuggestFixResult {
  violationId: string;
  confidence: FixConfidence;
  pattern: string | null;
  frameworkAdaptation: string | null;
  references: string[];
  hint?: string;
}

/**
 * Built-in canonical patterns for a small set of WCAG criteria. The full
 * catalogue lives upstream in `@ariada-org/wcag-rules-extended` — this map is the
 * minimal lookup the v0.1 server ships with.
 */
const CANONICAL_PATTERNS: Record<string, { html: string; references: string[] }> = {
  '1.3.1': {
    html: '<fieldset>\n  <legend>Payment details</legend>\n  <label for="card">Card number</label>\n  <input id="card" name="card" autocomplete="cc-number" />\n</fieldset>',
    references: [
      'https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships',
      'https://www.etsi.org/deliver/etsi_en/301500_301599/301549/',
    ],
  },
  '2.4.7': {
    html: '<style>\n  :focus-visible { outline: 3px solid #005a9c; outline-offset: 2px; }\n</style>',
    references: [
      'https://www.w3.org/WAI/WCAG22/Understanding/focus-visible',
    ],
  },
  '4.1.2': {
    html: '<button type="button" aria-pressed="false" aria-label="Add to cart">Add</button>',
    references: [
      'https://www.w3.org/WAI/WCAG22/Understanding/name-role-value',
    ],
  },
};

function adaptToFramework(
  html: string,
  framework: NonNullable<NonNullable<SuggestFixInput['context']>['framework']>,
): string {
  if (framework === 'react') return html.replace(/for=/g, 'htmlFor=').replace(/class=/g, 'className=');
  if (framework === 'svelte' || framework === 'solid' || framework === 'vue' || framework === 'angular') {
    return html; // these frameworks accept plain HTML attribute names
  }
  return html;
}

/**
 * Execute the `ariada.suggest-fix` tool. Returns a canonical pattern when one
 * is registered, an adapted pattern when a framework hint is provided, and
 * the fallback hint when the violation has no known canonical fix.
 */
export function runSuggestFix(input: SuggestFixInput): SuggestFixResult {
  const canonical = canonicalRuleId(input.violationId);
  const all = runListRules({});
  const rule = all.find((r) => r.id === canonical);
  if (!rule) {
    return {
      violationId: input.violationId,
      confidence: 'no-known-pattern',
      pattern: null,
      frameworkAdaptation: null,
      references: [],
      hint: 'No canonical fix pattern in corpus — consult an accessibility specialist or the W3C Understanding document.',
    };
  }
  // Find the first WCAG SC for which we have a canonical pattern.
  let chosen: { html: string; references: string[] } | null = null;
  for (const sc of rule.wcagSuccessCriteria) {
    const found = CANONICAL_PATTERNS[sc];
    if (found) {
      chosen = found;
      break;
    }
  }
  if (!chosen) {
    return {
      violationId: input.violationId,
      confidence: 'no-known-pattern',
      pattern: null,
      frameworkAdaptation: null,
      references: rule.helpUrl ? [rule.helpUrl] : [],
      hint: 'No canonical fix pattern in corpus — consult an accessibility specialist or the W3C Understanding document.',
    };
  }
  const framework = input.context?.framework ?? 'html';
  const adapted = framework === 'html' ? null : adaptToFramework(chosen.html, framework);
  return {
    violationId: input.violationId,
    confidence: adapted ? 'adapted' : 'canonical',
    pattern: chosen.html,
    frameworkAdaptation: adapted,
    references: chosen.references,
  };
}
