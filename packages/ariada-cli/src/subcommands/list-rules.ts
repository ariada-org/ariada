// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { allRules } from '@ariada-org/wcag-rules-extended';

import { CliError, emitError } from '../errors.js';
import { EXIT_OK, EXIT_INVALID_ARGS, EXIT_RUNTIME_ERROR, type ExitCode } from '../exit-codes.js';

/**
 *
 */
export interface ListRulesOptions {
  format?: 'human' | 'json';
  pack?: 'checkout' | 'banking' | 'statement' | 'all';
}

interface RuleSummary {
  id: string;
  pack: string;
  impact: string;
  wcag: string[];
  en301549: string[];
  description?: string;
}

/**
 * Coerce an unknown rule object from @ariada-org/wcag-rules-extended into a
 * presentation-stable RuleSummary. The upstream type is rich; we extract
 * only the fields the CLI displays.
 *
 * Schema notes (verified against wcag-rules-extended v0.1.0):
 *   - rule.id is namespaced: `ariada/<pack>/<rule-name>` where pack ∈
 *     {checkout, statement, banking}. We derive `pack` from the id.
 *   - rule.metadata.wcag is a string[] of dotted SC numbers (e.g., "1.3.1").
 *   - rule.metadata.en301549 is a string[] of clauses (e.g., "9.1.3.1").
 *   - rule.tags carries axe-core-style hints (cat.*, wcag2a, EAA, EAA-I3)
 *     useful as fallback if metadata is sparse.
 */
function summariseRule(rule: unknown): RuleSummary {
  const r = rule as Record<string, unknown>;
  const tags = Array.isArray(r['tags']) ? (r['tags'] as string[]) : [];
  const metadata = (r['metadata'] as Record<string, unknown> | undefined) ?? {};
  const wcagFromMeta = Array.isArray(metadata['wcag'])
    ? (metadata['wcag'] as string[])
    : [];
  const enFromMeta = Array.isArray(metadata['en301549'])
    ? (metadata['en301549'] as string[])
    : [];

  // Derive pack from rule id (e.g., `ariada/checkout/payment-fieldset-grouping`).
  const id = typeof r['id'] === 'string' ? (r['id'] as string) : 'unknown';
  const idParts = id.split('/');
  const packFromId = idParts.length >= 2 && idParts[0] === 'ariada' ? idParts[1] : undefined;
  const pack =
    packFromId === 'checkout' || packFromId === 'statement' || packFromId === 'banking'
      ? packFromId
      : 'unknown';

  // WCAG SCs may also live under tags as 'wcag2aa', 'wcag22aa', 'wcag111' style.
  const wcagFromTags = tags.filter((t) => /^wcag\d/.test(t));

  const summary: RuleSummary = {
    id,
    pack,
    impact: typeof r['impact'] === 'string' ? (r['impact'] as string) : 'moderate',
    wcag: wcagFromMeta.length > 0 ? wcagFromMeta : wcagFromTags,
    en301549: enFromMeta,
  };
  if (typeof metadata['description'] === 'string') {
    summary.description = metadata['description'] as string;
  }
  return summary;
}

function filterByPack(rules: RuleSummary[], pack: ListRulesOptions['pack']): RuleSummary[] {
  if (!pack || pack === 'all') return rules;
  return rules.filter((r) => r.pack === pack);
}

function formatHuman(rules: RuleSummary[]): string {
  if (rules.length === 0) return '(no rules registered)\n';
  const header = `${rules.length} rule${rules.length === 1 ? '' : 's'} registered\n`;
  const body = rules
    .map((r) => {
      const wcag = r.wcag.length > 0 ? r.wcag.join(', ') : '—';
      const en = r.en301549.length > 0 ? r.en301549.join(', ') : '—';
      return `  ${r.id}  [${r.pack}, ${r.impact}]\n    WCAG: ${wcag}\n    EN 301 549: ${en}`;
    })
    .join('\n');
  return `${header}\n${body}\n`;
}

function formatJson(rules: RuleSummary[]): string {
  return `${JSON.stringify(rules, null, 2)}\n`;
}

/**
 * Render every rule registered by @ariada-org/wcag-rules-extended.
 * Exits 0 on success even with zero rules — that's a degenerate but valid state.
 */
export async function runListRules(
  options: ListRulesOptions,
  stdout: NodeJS.WritableStream = process.stdout,
  stderr: NodeJS.WritableStream = process.stderr,
): Promise<ExitCode> {
  const format = options.format ?? 'human';
  if (format !== 'human' && format !== 'json') {
    emitError(
      new CliError('E_INVALID_OPTION', `Unknown --format value: ${format}`, {
        allowed: ['human', 'json'],
      }),
      stderr,
    );
    return EXIT_INVALID_ARGS;
  }

  try {
    const summaries = (allRules as unknown[]).map(summariseRule);
    const filtered = filterByPack(summaries, options.pack);
    const out = format === 'json' ? formatJson(filtered) : formatHuman(filtered);
    stdout.write(out);
    return EXIT_OK;
  } catch (err) {
    emitError(
      new CliError('E_INTERNAL', err instanceof Error ? err.message : String(err)),
      stderr,
    );
    return EXIT_RUNTIME_ERROR;
  }
}
