// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
/**
 * @ariada/wcag-rules-extended — public entry point.
 *
 * EAA 2025-ready WCAG 2.2 AA rule packs for axe-core, under EUPL-1.2.
 *
 * @see README.md
 */

import { bankingRules, bankingChecks } from './rules/banking/index.js';
import { ecommerceCheckoutRules, ecommerceCheckoutChecks } from './rules/checkout/index.js';
import { statementRules, statementChecks } from './rules/statement/index.js';
import type { RuleDefinition, CheckDefinition } from './types.js';

export type {
  RuleDefinition,
  CheckDefinition,
  CheckEvaluate,
  RuleMetadata,
  RulePack,
  Impact,
  WcagSuccessCriterion,
  En301549Clause,
  EaaAnnexISection,
  Locale,
  LocaleBundle,
  RuleMessages,
} from './types.js';

export {
  ecommerceCheckoutRules,
  ecommerceCheckoutChecks,
  ecommerceCheckoutPack,
} from './rules/checkout/index.js';

export {
  statementRules,
  statementChecks,
  statementPack,
} from './rules/statement/index.js';

export {
  bankingRules,
  bankingChecks,
  bankingPack,
} from './rules/banking/index.js';

// Compliance-evidence emitters (VPAT / EN 301 549 / DOS-lagen)
export {
  emitVpat,
  emitEn301549,
  emitDosLagen,
  WCAG_22_CRITERIA,
} from './evidence/index.js';

export type {
  Violation,
  ReportMeta,
  VpatReport,
  VpatCriterion,
  VpatConformanceLevel,
  En301549Report,
  En301549Row,
  En301549Status,
  DosLagenReport,
  DosLagenStatus,
  DosLagenOptions,
} from './evidence/index.js';

// Penalty exposure estimator (EAA / national-law)
export {
  estimatePenalty,
  listJurisdictions,
  JURISDICTION_PROFILES,
} from './penalty/index.js';

export type {
  Jurisdiction,
  JurisdictionProfile,
  EstimateOptions,
  EstimateResult,
} from './penalty/index.js';

// Accessibility-statement generator (Nordic locales)
export { generateStatement, STATEMENT_MESSAGES } from './statement/index.js';

export type {
  GeneratedStatement,
  GenerateStatementOptions,
  StatementJurisdiction,
  StatementConformance,
  StatementFormat,
  StatementMessages,
} from './statement/index.js';

/**
 * Aggregate of all rules and checks across all packs.
 */
export const allRules: RuleDefinition[] = [
  ...ecommerceCheckoutRules,
  ...statementRules,
  ...bankingRules,
];
export const allChecks: CheckDefinition[] = [
  ...ecommerceCheckoutChecks,
  ...statementChecks,
  ...bankingChecks,
];

/**
 * Minimal axe-like interface for the {@link addEaaRules} helper. Avoids
 * a hard dependency on axe-core types (peer dep is at runtime only).
 */
interface AxeLikeConfigurable {
  configure: (config: { rules?: RuleDefinition[]; checks?: CheckDefinition[] }) => void;
}

/**
 * Register all EAA-aligned rules and checks on a provided axe-core instance.
 *
 * @example
 * ```ts
 * import axe from 'axe-core';
 * import { addEaaRules } from '@ariada/wcag-rules-extended';
 * addEaaRules(axe);
 * const results = await axe.run();
 * ```
 */
export function addEaaRules(axe: AxeLikeConfigurable): void {
  axe.configure({ rules: allRules, checks: allChecks });
}

/**
 * Return an axe-core configuration object suitable for `axe.configure()`.
 *
 * @example
 * ```ts
 * import axe from 'axe-core';
 * import { eaaConfig } from '@ariada/wcag-rules-extended';
 * axe.configure(eaaConfig());
 * ```
 */
export function eaaConfig(): { rules: RuleDefinition[]; checks: CheckDefinition[] } {
  return { rules: allRules, checks: allChecks };
}
