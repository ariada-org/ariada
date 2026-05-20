// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

import { allRules } from '@ariada/wcag-rules-extended';
import { z } from 'zod';

/**
 * Input schema for the `ariada.list-rules` tool.
 */
export const listRulesInputSchema = z.object({
  pack: z.enum(['checkout', 'banking', 'statement', 'all']).default('all').optional(),
  wcagOnly: z.boolean().default(false).optional(),
  en301549Only: z.boolean().default(false).optional(),
});

/** Parsed input for the `ariada.list-rules` tool. */
export type ListRulesInput = z.infer<typeof listRulesInputSchema>;

/**
 * Normalised rule summary returned by `ariada.list-rules`.
 */
export interface RuleSummary {
  id: string;
  pack: 'checkout' | 'banking' | 'statement' | 'unknown';
  description: string;
  defaultSeverity: 'minor' | 'moderate' | 'serious' | 'critical';
  wcagSuccessCriteria: string[];
  en301549Clauses: string[];
  helpUrl: string;
}

function packFromId(id: string): RuleSummary['pack'] {
  const parts = id.split('/');
  if (parts.length < 2 || parts[0] !== 'ariada') return 'unknown';
  const p = parts[1];
  if (p === 'checkout' || p === 'banking' || p === 'statement') return p;
  return 'unknown';
}

/**
 * Summarise a raw rule object into the schema published by the MCP tool.
 */
export function summariseRule(rule: unknown): RuleSummary {
  const r = rule as Record<string, unknown>;
  const id = typeof r['id'] === 'string' ? r['id'] : 'unknown';
  const metadata = (r['metadata'] as Record<string, unknown> | undefined) ?? {};
  const description =
    typeof metadata['description'] === 'string' ? metadata['description'] : '';
  const helpUrl = typeof metadata['helpUrl'] === 'string' ? metadata['helpUrl'] : '';
  const wcag = Array.isArray(metadata['wcag']) ? (metadata['wcag'] as string[]) : [];
  const en = Array.isArray(metadata['en301549']) ? (metadata['en301549'] as string[]) : [];
  const impact = typeof r['impact'] === 'string' ? (r['impact'] as string) : 'moderate';
  const sev: RuleSummary['defaultSeverity'] =
    impact === 'minor' || impact === 'moderate' || impact === 'serious' || impact === 'critical'
      ? impact
      : 'moderate';
  return {
    id,
    pack: packFromId(id),
    description,
    defaultSeverity: sev,
    wcagSuccessCriteria: wcag,
    en301549Clauses: en,
    helpUrl,
  };
}

/**
 * Execute the `ariada.list-rules` tool. Pure lookup — no network, no
 * Playwright, no LLM inference.
 */
export function runListRules(input: ListRulesInput): RuleSummary[] {
  const all = (allRules as unknown[]).map(summariseRule);
  let filtered = all;
  if (input.pack && input.pack !== 'all') {
    filtered = filtered.filter((r) => r.pack === input.pack);
  }
  if (input.wcagOnly === true) {
    filtered = filtered.filter((r) => r.wcagSuccessCriteria.length > 0);
  }
  if (input.en301549Only === true) {
    filtered = filtered.filter((r) => r.en301549Clauses.length > 0);
  }
  return filtered;
}
