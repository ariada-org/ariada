// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
/**
 * Snapshot tests for rule + checkDefinition metadata across all 6 packs.
 *
 * Purpose: catch accidental schema changes — a metadata field rename, a
 * dropped WCAG SC, a changed impact level, or an altered help-URL would
 * otherwise slip into a release silently. Snapshotting the structured
 * metadata block per rule makes the diff explicit at PR review time.
 *
 * Re-snapshot intentional changes with `pnpm test -- -u` and audit the
 * diff before committing.
 *
 * Coverage: 46 rules total (11 checkout + 10 statement + 10 banking + 5 e-books
 * + 5 audiovisual + 5 transport).
 */

import { describe, it, expect } from 'vitest';

// Imports are sorted by path to satisfy import/order (audiovisual, banking,
// checkout, ebooks, statement, transport); the `describe` blocks below group
// the assertions by pack rather than by import order.
import * as captionsSource from './audiovisual/captions-track-has-src.js';
import * as mediaName from './audiovisual/media-element-has-accessible-name.js';
import * as trackKind from './audiovisual/track-has-valid-kind.js';
import * as audioDescription from './audiovisual/video-has-audio-description-track.js';
import * as captionsTrack from './audiovisual/video-has-captions-track.js';
import * as twoFa from './banking/2fa-keyboard-accessible.js';
import * as bankLoginError from './banking/bank-login-error-not-blocking.js';
import * as currencyFormat from './banking/currency-format-readable.js';
import * as dateFormat from './banking/date-format-locale.js';
import * as ibanInput from './banking/iban-input-format.js';
import * as langMatches from './banking/lang-matches-locale.js';
import * as localeFallback from './banking/locale-fallback.js';
import * as numericError from './banking/numeric-validation-error.js';
import * as sessionTimeout from './banking/session-timeout-warning.js';
import * as transactionAmount from './banking/transaction-amount-input.js';
import * as autocomplete from './checkout/autocomplete-personal-data.js';
import * as cartQuantity from './checkout/cart-quantity-input-label.js';
import * as cartUpdate from './checkout/cart-update-live-region.js';
import * as errorIdentification from './checkout/checkout-error-identification.js';
import * as formLabel from './checkout/checkout-form-label-association.js';
import * as stepKeyboard from './checkout/checkout-step-keyboard.js';
import * as discountCode from './checkout/discount-code-feedback.js';
import * as orderConfirmation from './checkout/order-confirmation-focus.js';
import * as paymentFieldset from './checkout/payment-fieldset-grouping.js';
import * as requiredField from './checkout/required-field-machine-readable.js';
import * as submitButton from './checkout/submit-button-accessible-name.js';
// Checkout pack — 11 rules (imported above); e-books pack — 5 rules.
import * as audioControl from './ebooks/audio-control-on-autoplay.js';
import * as positiveTabindex from './ebooks/no-positive-tabindex-in-reading.js';
import * as readingLang from './ebooks/reading-content-has-lang.js';
import * as textSpacing from './ebooks/text-spacing-overridable.js';
import * as viewportZoom from './ebooks/viewport-allows-zoom.js';
// Statement pack — 10 rules.
import * as conformanceLevel from './statement/statement-conformance-level.js';
import * as enforcementProcedure from './statement/statement-enforcement-procedure.js';
import * as feedbackMechanism from './statement/statement-feedback-mechanism.js';
import * as lastRevision from './statement/statement-last-revision-date.js';
import * as methodology from './statement/statement-methodology.js';
import * as nonConformance from './statement/statement-non-conformance-items.js';
import * as statementPage from './statement/statement-page-exists.js';
import * as publicationDate from './statement/statement-publication-date.js';
import * as skipLink from './statement/statement-skip-link.js';
import * as standardReference from './statement/statement-standard-reference.js';
// Transport pack — 5 rules.
import * as bookingTimeout from './transport/booking-timeout-has-warning.js';
import * as fareTable from './transport/fare-table-has-caption.js';
import * as liveStatus from './transport/live-status-has-live-region.js';
import * as seatSelection from './transport/seat-selection-has-accessible-name.js';
import * as timetable from './transport/timetable-has-header-cells.js';

interface RuleModule {
  rule: { id: string; selector: string; tags: string[]; any: string[]; all: string[]; none: string[] };
  checkDefinition: { id: string; metadata?: unknown };
  metadata: unknown;
}

/**
 * Project the rule module to the stable shape we want to snapshot. Avoids
 * snapshotting function references (`check.evaluate`) which would flap on
 * minor refactors.
 */
function projectRule(module_: RuleModule) {
  return {
    metadata: module_.metadata,
    rule: {
      id: module_.rule.id,
      selector: module_.rule.selector,
      tags: module_.rule.tags,
      any: module_.rule.any,
      all: module_.rule.all,
      none: module_.rule.none,
    },
    checkDefinition: {
      id: module_.checkDefinition.id,
      metadata: module_.checkDefinition.metadata,
    },
  };
}

describe('Pack A (checkout) — metadata snapshots', () => {
  it('autocomplete-personal-data', () => {
    expect(projectRule(autocomplete)).toMatchSnapshot();
  });
  it('cart-quantity-input-label', () => {
    expect(projectRule(cartQuantity)).toMatchSnapshot();
  });
  it('cart-update-live-region', () => {
    expect(projectRule(cartUpdate)).toMatchSnapshot();
  });
  it('checkout-error-identification', () => {
    expect(projectRule(errorIdentification)).toMatchSnapshot();
  });
  it('checkout-form-label-association', () => {
    expect(projectRule(formLabel)).toMatchSnapshot();
  });
  it('checkout-step-keyboard', () => {
    expect(projectRule(stepKeyboard)).toMatchSnapshot();
  });
  it('discount-code-feedback', () => {
    expect(projectRule(discountCode)).toMatchSnapshot();
  });
  it('order-confirmation-focus', () => {
    expect(projectRule(orderConfirmation)).toMatchSnapshot();
  });
  it('payment-fieldset-grouping', () => {
    expect(projectRule(paymentFieldset)).toMatchSnapshot();
  });
  it('required-field-machine-readable', () => {
    expect(projectRule(requiredField)).toMatchSnapshot();
  });
  it('submit-button-accessible-name', () => {
    expect(projectRule(submitButton)).toMatchSnapshot();
  });
});

describe('Pack B (statement) — metadata snapshots', () => {
  it('statement-conformance-level', () => {
    expect(projectRule(conformanceLevel)).toMatchSnapshot();
  });
  it('statement-enforcement-procedure', () => {
    expect(projectRule(enforcementProcedure)).toMatchSnapshot();
  });
  it('statement-feedback-mechanism', () => {
    expect(projectRule(feedbackMechanism)).toMatchSnapshot();
  });
  it('statement-last-revision-date', () => {
    expect(projectRule(lastRevision)).toMatchSnapshot();
  });
  it('statement-methodology', () => {
    expect(projectRule(methodology)).toMatchSnapshot();
  });
  it('statement-non-conformance-items', () => {
    expect(projectRule(nonConformance)).toMatchSnapshot();
  });
  it('statement-page-exists', () => {
    expect(projectRule(statementPage)).toMatchSnapshot();
  });
  it('statement-publication-date', () => {
    expect(projectRule(publicationDate)).toMatchSnapshot();
  });
  it('statement-skip-link', () => {
    expect(projectRule(skipLink)).toMatchSnapshot();
  });
  it('statement-standard-reference', () => {
    expect(projectRule(standardReference)).toMatchSnapshot();
  });
});

describe('Pack C (banking) — metadata snapshots', () => {
  it('2fa-keyboard-accessible', () => {
    expect(projectRule(twoFa)).toMatchSnapshot();
  });
  it('bank-login-error-not-blocking', () => {
    expect(projectRule(bankLoginError)).toMatchSnapshot();
  });
  it('currency-format-readable', () => {
    expect(projectRule(currencyFormat)).toMatchSnapshot();
  });
  it('date-format-locale', () => {
    expect(projectRule(dateFormat)).toMatchSnapshot();
  });
  it('iban-input-format', () => {
    expect(projectRule(ibanInput)).toMatchSnapshot();
  });
  it('lang-matches-locale', () => {
    expect(projectRule(langMatches)).toMatchSnapshot();
  });
  it('locale-fallback', () => {
    expect(projectRule(localeFallback)).toMatchSnapshot();
  });
  it('numeric-validation-error', () => {
    expect(projectRule(numericError)).toMatchSnapshot();
  });
  it('session-timeout-warning', () => {
    expect(projectRule(sessionTimeout)).toMatchSnapshot();
  });
  it('transaction-amount-input', () => {
    expect(projectRule(transactionAmount)).toMatchSnapshot();
  });
});

describe('Pack E (e-books) — metadata snapshots', () => {
  it('viewport-allows-zoom', () => {
    expect(projectRule(viewportZoom)).toMatchSnapshot();
  });
  it('text-spacing-overridable', () => {
    expect(projectRule(textSpacing)).toMatchSnapshot();
  });
  it('audio-control-on-autoplay', () => {
    expect(projectRule(audioControl)).toMatchSnapshot();
  });
  it('reading-content-has-lang', () => {
    expect(projectRule(readingLang)).toMatchSnapshot();
  });
  it('no-positive-tabindex-in-reading', () => {
    expect(projectRule(positiveTabindex)).toMatchSnapshot();
  });
});

describe('Pack F (audiovisual) — metadata snapshots', () => {
  it('video-has-captions-track', () => {
    expect(projectRule(captionsTrack)).toMatchSnapshot();
  });
  it('video-has-audio-description-track', () => {
    expect(projectRule(audioDescription)).toMatchSnapshot();
  });
  it('media-element-has-accessible-name', () => {
    expect(projectRule(mediaName)).toMatchSnapshot();
  });
  it('track-has-valid-kind', () => {
    expect(projectRule(trackKind)).toMatchSnapshot();
  });
  it('captions-track-has-src', () => {
    expect(projectRule(captionsSource)).toMatchSnapshot();
  });
});

describe('Pack G (transport) — metadata snapshots', () => {
  it('timetable-has-header-cells', () => {
    expect(projectRule(timetable)).toMatchSnapshot();
  });
  it('live-status-has-live-region', () => {
    expect(projectRule(liveStatus)).toMatchSnapshot();
  });
  it('seat-selection-has-accessible-name', () => {
    expect(projectRule(seatSelection)).toMatchSnapshot();
  });
  it('booking-timeout-has-warning', () => {
    expect(projectRule(bookingTimeout)).toMatchSnapshot();
  });
  it('fare-table-has-caption', () => {
    expect(projectRule(fareTable)).toMatchSnapshot();
  });
});
