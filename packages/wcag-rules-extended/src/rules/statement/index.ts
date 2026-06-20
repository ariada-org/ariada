// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
/**
 * Pack B — Accessibility statement compliance rules.
 *
 * 10 rules covering: page existence (footer link), publication date,
 * conformance level declaration, last-revision date, methodology disclosure,
 * non-conformance items enumeration, feedback mechanism, enforcement
 * procedure link, standard reference (WCAG / EN 301 549), and site-wide
 * skip-link presence.
 *
 * EAA Annex I §I.1 (general — accessibility documentation accessible)
 * + Directive 2016/2102 art. 7 (statement requirements).
 * DOS-lagen (SE) + tilgjengelighet (NO) + saavutettavuuslaki (FI).
 */

import type { RuleDefinition, CheckDefinition, RulePack } from '../../types.js';

import {
  rule as conformanceRule,
  checkDefinition as conformanceCheck,
} from './statement-conformance-level.js';
import {
  rule as enforcementRule,
  checkDefinition as enforcementCheck,
} from './statement-enforcement-procedure.js';
import {
  rule as feedbackRule,
  checkDefinition as feedbackCheck,
} from './statement-feedback-mechanism.js';
import {
  rule as revisionDateRule,
  checkDefinition as revisionDateCheck,
} from './statement-last-revision-date.js';
import {
  rule as methodologyRule,
  checkDefinition as methodologyCheck,
} from './statement-methodology.js';
import {
  rule as nonConfigRule,
  checkDefinition as nonConfigCheck,
} from './statement-non-conformance-items.js';
import {
  rule as pageLinkRule,
  checkDefinition as pageLinkCheck,
} from './statement-page-exists.js';
import {
  rule as pubDateRule,
  checkDefinition as pubDateCheck,
} from './statement-publication-date.js';
import {
  rule as skipLinkRule,
  checkDefinition as skipLinkCheck,
} from './statement-skip-link.js';
import {
  rule as standardRefRule,
  checkDefinition as standardRefCheck,
} from './statement-standard-reference.js';

export const statementRules: RuleDefinition[] = [
  pageLinkRule,
  pubDateRule,
  conformanceRule,
  revisionDateRule,
  methodologyRule,
  nonConfigRule,
  feedbackRule,
  enforcementRule,
  standardRefRule,
  skipLinkRule,
];

export const statementChecks: CheckDefinition[] = [
  pageLinkCheck,
  pubDateCheck,
  conformanceCheck,
  revisionDateCheck,
  methodologyCheck,
  nonConfigCheck,
  feedbackCheck,
  enforcementCheck,
  standardRefCheck,
  skipLinkCheck,
];

export const statementPack: RulePack = {
  id: 'statement',
  name: 'Accessibility statement compliance (DOS-lagen / EN 301 549)',
  description:
    'Rule pack ensuring accessibility statement page meets Directive 2016/2102 art. 7 and EAA-mirrored requirements for private-sector e-commerce / banking services.',
  rules: statementRules,
  checks: statementChecks,
};
