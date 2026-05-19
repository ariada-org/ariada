// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
/**
 * Pack C — Banking services + Nordic locale rules.
 *
 * 10 rules covering EAA Annex I §I.4 (banking digital channels) and
 * cross-cutting Nordic-locale concerns relevant beyond banking (lang
 * attribute correctness, locale fallback, error localisation).
 */

import type { RuleDefinition, CheckDefinition, RulePack } from '../../types.js';

import {
  rule as twofaRule,
  checkDefinition as twofaCheck,
} from './2fa-keyboard-accessible.js';
import {
  rule as loginErrorRule,
  checkDefinition as loginErrorCheck,
} from './bank-login-error-not-blocking.js';
import {
  rule as currencyRule,
  checkDefinition as currencyCheck,
} from './currency-format-readable.js';
import {
  rule as dateFormatRule,
  checkDefinition as dateFormatCheck,
} from './date-format-locale.js';
import {
  rule as ibanRule,
  checkDefinition as ibanCheck,
} from './iban-input-format.js';
import {
  rule as langMatchRule,
  checkDefinition as langMatchCheck,
} from './lang-matches-locale.js';
import {
  rule as localeFallbackRule,
  checkDefinition as localeFallbackCheck,
} from './locale-fallback.js';
import {
  rule as numericErrorRule,
  checkDefinition as numericErrorCheck,
} from './numeric-validation-error.js';
import {
  rule as sessionTimeoutRule,
  checkDefinition as sessionTimeoutCheck,
} from './session-timeout-warning.js';
import {
  rule as amountRule,
  checkDefinition as amountCheck,
} from './transaction-amount-input.js';

export const bankingRules: RuleDefinition[] = [
  twofaRule,
  amountRule,
  sessionTimeoutRule,
  langMatchRule,
  dateFormatRule,
  localeFallbackRule,
  ibanRule,
  numericErrorRule,
  loginErrorRule,
  currencyRule,
];

export const bankingChecks: CheckDefinition[] = [
  twofaCheck,
  amountCheck,
  sessionTimeoutCheck,
  langMatchCheck,
  dateFormatCheck,
  localeFallbackCheck,
  ibanCheck,
  numericErrorCheck,
  loginErrorCheck,
  currencyCheck,
];

export const bankingPack: RulePack = {
  id: 'banking',
  name: 'Banking services + Nordic locale (EAA Annex I §I.4)',
  description:
    'Rule pack targeting EAA-2025 banking digital channels with extra attention to Nordic-locale concerns (sv/nb/da/fi).',
  rules: bankingRules,
  checks: bankingChecks,
};
