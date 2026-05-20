// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

import { z } from 'zod';

import { runListRules, summariseRule, type RuleSummary } from './list-rules.js';

/**
 * Input schema for the `ariada.explain-violation` tool.
 */
export const explainViolationInputSchema = z.object({
  violationId: z.string().min(1),
  locale: z.enum(['en', 'sv', 'nb', 'da', 'fi']).default('en').optional(),
  depth: z.enum(['short', 'long']).default('short').optional(),
});

/** Parsed input for the `ariada.explain-violation` tool. */
export type ExplainViolationInput = z.infer<typeof explainViolationInputSchema>;

/**
 * Output shape for a known violation.
 */
export interface ExplanationKnown {
  status: 'known';
  violationId: string;
  summary: string;
  wcagCitation: string[];
  en301549Citation: string[];
  helpUrl: string;
  whyMatters: string;
  whoAffected: string;
}

/**
 * Output shape when the violation ID is not registered.
 */
export interface ExplanationUnknown {
  status: 'unknown-violation';
  violationId: string;
}

/** Union of the two possible result shapes returned by `runExplainViolation`. */
export type ExplanationResult = ExplanationKnown | ExplanationUnknown;

/**
 * Extract the canonical rule ID from either a bare rule ID
 * (`ariada/checkout/payment-fieldset-grouping`) or a fully-qualified finding
 * ID (`ariada/checkout/payment-fieldset-grouping#form-order`).
 */
export function canonicalRuleId(violationId: string): string {
  const hashIdx = violationId.indexOf('#');
  return hashIdx >= 0 ? violationId.slice(0, hashIdx) : violationId;
}

function lookup(violationId: string): RuleSummary | null {
  const canonical = canonicalRuleId(violationId);
  const all = runListRules({});
  return all.find((r) => r.id === canonical) ?? null;
}

/**
 * Execute the `ariada.explain-violation` tool. Pure lookup against the rule
 * catalogue — never fabricates text for unknown IDs.
 */
export function runExplainViolation(input: ExplainViolationInput): ExplanationResult {
  const rule = lookup(input.violationId);
  if (!rule) {
    return { status: 'unknown-violation', violationId: input.violationId };
  }
  return {
    status: 'known',
    violationId: input.violationId,
    summary: rule.description,
    wcagCitation: rule.wcagSuccessCriteria,
    en301549Citation: rule.en301549Clauses,
    helpUrl: rule.helpUrl,
    whyMatters: `Affects users relying on assistive technology to perceive or operate the ${rule.pack} flow.`,
    whoAffected:
      'Screen-reader users, keyboard-only operators, users with cognitive disabilities, and users on low-bandwidth or assistive-tech-augmented connections.',
  };
}

export { summariseRule };
