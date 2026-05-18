// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
/**
 * Pack A — EAA Annex I §I.3 e-commerce checkout flow rules.
 *
 * 10 rules covering: payment-method grouping, cart live regions, error
 * identification, required-field machine-readability, autocomplete on
 * personal data, submit-button accessible names, cart quantity labels,
 * order confirmation focus management, discount-code feedback, checkout
 * step keyboard accessibility, and overall checkout-form label association.
 */

import type { RuleDefinition, CheckDefinition, RulePack } from '../../types.js';

import {
  rule as autocompleteRule,
  checkDefinition as autocompleteCheck,
} from './autocomplete-personal-data.js';
import {
  rule as cartQuantityRule,
  checkDefinition as cartQuantityCheck,
} from './cart-quantity-input-label.js';
import {
  rule as cartUpdateLiveRegionRule,
  checkDefinition as cartUpdateLiveRegionCheck,
} from './cart-update-live-region.js';
import {
  rule as errorIdentificationRule,
  checkDefinition as errorIdentificationCheck,
} from './checkout-error-identification.js';
import {
  rule as formLabelAssociationRule,
  checkDefinition as formLabelAssociationCheck,
} from './checkout-form-label-association.js';
import {
  rule as stepKeyboardRule,
  checkDefinition as stepKeyboardCheck,
} from './checkout-step-keyboard.js';
import {
  rule as discountCodeRule,
  checkDefinition as discountCodeCheck,
} from './discount-code-feedback.js';
import {
  rule as orderConfirmationRule,
  checkDefinition as orderConfirmationCheck,
} from './order-confirmation-focus.js';
import {
  rule as paymentFieldsetGroupingRule,
  checkDefinition as paymentFieldsetGroupingCheck,
} from './payment-fieldset-grouping.js';
import {
  rule as requiredFieldRule,
  checkDefinition as requiredFieldCheck,
} from './required-field-machine-readable.js';
import {
  rule as submitButtonRule,
  checkDefinition as submitButtonCheck,
} from './submit-button-accessible-name.js';

export const ecommerceCheckoutRules: RuleDefinition[] = [
  paymentFieldsetGroupingRule,
  cartUpdateLiveRegionRule,
  errorIdentificationRule,
  requiredFieldRule,
  autocompleteRule,
  submitButtonRule,
  cartQuantityRule,
  orderConfirmationRule,
  discountCodeRule,
  stepKeyboardRule,
  formLabelAssociationRule,
];

export const ecommerceCheckoutChecks: CheckDefinition[] = [
  paymentFieldsetGroupingCheck,
  cartUpdateLiveRegionCheck,
  errorIdentificationCheck,
  requiredFieldCheck,
  autocompleteCheck,
  submitButtonCheck,
  cartQuantityCheck,
  orderConfirmationCheck,
  discountCodeCheck,
  stepKeyboardCheck,
  formLabelAssociationCheck,
];

export const ecommerceCheckoutPack: RulePack = {
  id: 'checkout',
  name: 'E-commerce checkout flow (EAA Annex I §I.3)',
  description:
    'Rule pack targeting EAA-2025 e-commerce checkout flows: cart, payment, error handling, order confirmation.',
  rules: ecommerceCheckoutRules,
  checks: ecommerceCheckoutChecks,
};
