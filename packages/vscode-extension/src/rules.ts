// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

/**
 * Static rule corpus for the v0.1 extension. The rule set is intentionally
 * the «static-tractable» subset that can be inferred from source files alone,
 * without a live DOM or computed styles.
 *
 * Live-DOM rules (contrast, focus order, computed styles) are surfaced only
 * via `ariada.scanUrl` which delegates to a separate runner.
 */

/**
 *
 */
export type RuleSeverity = 'minor' | 'moderate' | 'serious' | 'critical';

/**
 *
 */
export interface RuleDefinition {
  readonly id: string;
  readonly wcagSc: string;
  readonly en301549: string;
  readonly severity: RuleSeverity;
  readonly shortMessage: string;
  readonly helpUrl: string;
}

const RULES: readonly RuleDefinition[] = [
  {
    id: 'wcag-22-1-1-1-image-alt',
    wcagSc: '1.1.1 Non-text Content',
    en301549: '9.1.1.1',
    severity: 'critical',
    shortMessage: 'Image missing alt attribute.',
    helpUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/non-text-content.html',
  },
  {
    id: 'wcag-22-1-3-1-form-label',
    wcagSc: '1.3.1 Info and Relationships',
    en301549: '9.1.3.1',
    severity: 'critical',
    shortMessage: 'Form input missing associated label.',
    helpUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html',
  },
  {
    id: 'wcag-22-1-3-1-heading-order',
    wcagSc: '1.3.1 Info and Relationships',
    en301549: '9.1.3.1',
    severity: 'serious',
    shortMessage: 'Heading level skips a step.',
    helpUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html',
  },
  {
    id: 'wcag-22-2-4-4-link-purpose',
    wcagSc: '2.4.4 Link Purpose (In Context)',
    en301549: '9.2.4.4',
    severity: 'serious',
    shortMessage: 'Link has no discernible text.',
    helpUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/link-purpose-in-context.html',
  },
  {
    id: 'wcag-22-2-4-6-heading-empty',
    wcagSc: '2.4.6 Headings and Labels',
    en301549: '9.2.4.6',
    severity: 'serious',
    shortMessage: 'Heading has no content.',
    helpUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/headings-and-labels.html',
  },
  {
    id: 'wcag-22-3-3-2-input-name',
    wcagSc: '3.3.2 Labels or Instructions',
    en301549: '9.3.3.2',
    severity: 'critical',
    shortMessage: 'Input missing accessible name.',
    helpUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions.html',
  },
  {
    id: 'wcag-22-4-1-2-button-name',
    wcagSc: '4.1.2 Name, Role, Value',
    en301549: '9.4.1.2',
    severity: 'critical',
    shortMessage: 'Button has no accessible name.',
    helpUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html',
  },
  {
    id: 'eaa-language-of-page',
    wcagSc: '3.1.1 Language of Page',
    en301549: '9.3.1.1',
    severity: 'moderate',
    shortMessage: 'Root html element missing lang attribute.',
    helpUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/language-of-page.html',
  },
];

/**
 *
 */
export function listRules(): readonly RuleDefinition[] {
  return RULES;
}

/**
 *
 */
export function getRule(id: string): RuleDefinition | undefined {
  return RULES.find((r) => r.id === id);
}

const SEVERITY_RANK: Record<RuleSeverity, number> = {
  minor: 0,
  moderate: 1,
  serious: 2,
  critical: 3,
};

/**
 *
 */
export function meetsThreshold(rule: RuleSeverity, threshold: RuleSeverity): boolean {
  return SEVERITY_RANK[rule] >= SEVERITY_RANK[threshold];
}

/**
 *
 */
export function buildCitation(rule: RuleDefinition): string {
  return `WCAG ${rule.wcagSc}; EN 301 549 §${rule.en301549}`;
}
