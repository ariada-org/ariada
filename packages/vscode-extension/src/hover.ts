// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

import { buildCitation, getRule, type RuleDefinition } from './rules.js';

/**
 * Builds the Markdown body of a hover panel for a given rule ID. Returns
 * undefined if the rule is unknown. The string is consumed by VS Code's
 * MarkdownString API with `isTrusted: false` (no command URIs).
 */
export function buildHoverMarkdown(ruleId: string): string | undefined {
  const rule = getRule(ruleId);
  if (!rule) {
    return undefined;
  }
  return formatHover(rule);
}

function formatHover(rule: RuleDefinition): string {
  const lines: string[] = [];
  lines.push(`**ariada** · \`${rule.id}\` · ${rule.severity}`);
  lines.push('');
  lines.push(rule.shortMessage);
  lines.push('');
  lines.push(`WCAG 2.2 ${rule.wcagSc}`);
  lines.push(`EN 301 549 §${rule.en301549}`);
  lines.push('');
  lines.push(`[Open canonical help](${rule.helpUrl})`);
  return lines.join('\n');
}

/**
 *
 */
export function buildClipboardCitation(ruleId: string): string | undefined {
  const rule = getRule(ruleId);
  if (!rule) {
    return undefined;
  }
  return buildCitation(rule);
}
