// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
/**
 * Aggregated rule packs entry point.
 *
 * Consumers can import individual packs:
 *
 *   import { ecommerceCheckoutRules } from '@ariada-org/wcag-rules-extended/rules';
 *
 * Or the combined set via the top-level package entry (see index.ts).
 */

export {
  ecommerceCheckoutRules,
  ecommerceCheckoutChecks,
  ecommerceCheckoutPack,
} from './checkout/index.js';

export {
  statementRules,
  statementChecks,
  statementPack,
} from './statement/index.js';

export {
  bankingRules,
  bankingChecks,
  bankingPack,
} from './banking/index.js';
