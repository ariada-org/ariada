// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Accessibility domain — wraps the axe baseline (image-alt) and all EAA-scoped
// rules from the wcag-rules-extended packs. Because the EAA rule implementations
// depend on live DOM APIs (querySelectorAll, closest, ownerDocument) they cannot
// be imported and run in pure synchronous extractors. Instead, detection is
// re-implemented here using lightweight scans over the captured
// PropertySnapshot.html string, which is the same raw HTML the browser rendered.
//
// Detection is split as required by the DomainModule contract:
//   perElement — element-attribute checks that use the domOutline (image-alt)
//   perDocument — HTML-string scanner checks for all EAA rules
//
// Each rule produces one or more feature flags in the feature sink. The evaluate()
// function reads those flags and emits Finding objects with stable ruleIds,
// severity values, and regulatory mappings.

import type {
  DomainModule,
  ElementHandle,
  ExtractedFeatures,
  FeatureSink,
  InteractionFeatureSpec,
  PropertySnapshot,
} from '../domain-contract.js';
import type { Finding, RegulatoryRef } from '../types.js';

import {
  collapseWhitespace,
  extractFirstElementContent,
  findHtmlElements,
  findHtmlOpeningTags,
  getHtmlAttribute,
  hasHtmlAttribute,
  type HtmlElementMatch,
  type HtmlOpeningTagMatch,
  htmlAttributeIncludesAny,
  stripHtmlComments,
  stripHtmlTags,
} from './html-utils.js';

// ---------------------------------------------------------------------------
// Feature key constants
// ---------------------------------------------------------------------------

const F = {
  // image-alt (perElement)
  MISSING_ALT: 'a11y:missing-alt',

  // audiovisual
  CAPTIONS_NO_SRC: 'a11y:captions-no-src',
  MEDIA_NO_NAME: 'a11y:media-no-accessible-name',
  TRACK_INVALID_KIND: 'a11y:track-invalid-kind',
  VIDEO_NO_AUDIO_DESC: 'a11y:video-no-audio-description',
  VIDEO_NO_CAPTIONS: 'a11y:video-no-captions',

  // banking
  TWO_FA_NOT_KEYBOARD: 'a11y:2fa-not-keyboard',
  CURRENCY_NO_MACHINE: 'a11y:currency-no-machine-readable',
  DATE_NO_FORMAT: 'a11y:date-no-format-hint',
  IBAN_NO_FORMAT: 'a11y:iban-no-format-hint',
  LANG_MISMATCH: 'a11y:lang-mismatch',
  LOCALE_FALLBACK: 'a11y:locale-fallback',
  LOGIN_ERROR_NO_LIVE: 'a11y:login-error-no-live',
  NUMERIC_ERROR_LOCALE: 'a11y:numeric-error-locale',
  SESSION_TIMEOUT_NO_EXTEND: 'a11y:session-timeout-no-extend',
  AMOUNT_INPUT_NO_FORMAT: 'a11y:amount-input-no-format',

  // checkout
  NO_AUTOCOMPLETE: 'a11y:no-autocomplete',
  QTY_VAGUE_LABEL: 'a11y:qty-vague-label',
  CART_NO_LIVE: 'a11y:cart-no-live-region',
  COUPON_NO_FEEDBACK: 'a11y:coupon-no-feedback',
  ERROR_NO_ANNOUNCE: 'a11y:error-no-announcement',
  INPUT_NO_LABEL: 'a11y:input-no-label',
  CONFIRM_NO_FOCUS: 'a11y:confirmation-no-focus',
  PAYMENT_NO_FIELDSET: 'a11y:payment-no-fieldset',
  REQUIRED_NOT_MACHINE: 'a11y:required-not-machine-readable',
  STEP_NOT_FOCUSABLE: 'a11y:step-not-focusable',
  SUBMIT_VAGUE: 'a11y:submit-vague-label',

  // ebooks
  AUTOPLAY_NO_CONTROL: 'a11y:autoplay-no-control',
  POSITIVE_TABINDEX: 'a11y:positive-tabindex-in-reading',
  READING_NO_LANG: 'a11y:reading-no-lang',
  TEXT_SPACING_IMPORTANT: 'a11y:text-spacing-important',
  VIEWPORT_BLOCKS_ZOOM: 'a11y:viewport-blocks-zoom',

  // statement
  STATEMENT_NO_CONFORMANCE: 'a11y:statement-no-conformance',
  STATEMENT_NO_ENFORCEMENT: 'a11y:statement-no-enforcement',
  STATEMENT_NO_FEEDBACK: 'a11y:statement-no-feedback',
  STATEMENT_NO_LAST_REVISION: 'a11y:statement-no-last-revision',
  STATEMENT_NO_METHODOLOGY: 'a11y:statement-no-methodology',
  STATEMENT_NO_NONCONFORMANCE: 'a11y:statement-no-nonconformance',
  FOOTER_NO_A11Y_LINK: 'a11y:footer-no-a11y-link',
  STATEMENT_NO_PUBDATE: 'a11y:statement-no-publication-date',
  NO_SKIP_LINK: 'a11y:no-skip-link',
  STATEMENT_NO_STANDARD: 'a11y:statement-no-standard-reference',

  // transport
  BOOKING_NO_TIMEOUT_WARN: 'a11y:booking-no-timeout-warning',
  FARE_TABLE_NO_CAPTION: 'a11y:fare-table-no-caption',
  LIVE_STATUS_NO_LIVE: 'a11y:live-status-no-live-region',
  SEAT_NO_NAME: 'a11y:seat-no-accessible-name',
  TIMETABLE_NO_HEADERS: 'a11y:timetable-no-header-cells',
} as const;

// ---------------------------------------------------------------------------
// Regulatory reference presets
// ---------------------------------------------------------------------------

const r = (...args: [string, string][]): RegulatoryRef[] =>
  args.map(([framework, code]) => ({ framework, code }) as RegulatoryRef);

/** The EN 301 549 framework label, referenced by most regulatory presets below. */
const EN = 'EN 301 549';

const REG = {
  WCAG_111: r(['WCAG', 'SC 1.1.1'], [EN, '9.1.1.1']),
  WCAG_122: r(['WCAG', 'SC 1.2.2'], [EN, '9.1.2.2']),
  WCAG_125: r(['WCAG', 'SC 1.2.5'], [EN, '9.1.2.5']),
  WCAG_131: r(['WCAG', 'SC 1.3.1'], [EN, '9.1.3.1']),
  WCAG_135: r(['WCAG', 'SC 1.3.5'], [EN, '9.1.3.5']),
  WCAG_142: r(['WCAG', 'SC 1.4.2'], [EN, '9.1.4.2']),
  WCAG_144: r(['WCAG', 'SC 1.4.4'], [EN, '9.1.4.4']),
  WCAG_1412: r(['WCAG', 'SC 1.4.12'], [EN, '9.1.4.12']),
  WCAG_211: r(['WCAG', 'SC 2.1.1'], [EN, '9.2.1.1']),
  WCAG_221: r(['WCAG', 'SC 2.2.1'], [EN, '9.2.2.1']),
  WCAG_241: r(['WCAG', 'SC 2.4.1'], [EN, '9.2.4.1']),
  WCAG_243: r(['WCAG', 'SC 2.4.3']),
  WCAG_246: r(['WCAG', 'SC 2.4.6']),
  WCAG_311: r(['WCAG', 'SC 3.1.1'], [EN, '9.3.1.1']),
  WCAG_312: r(['WCAG', 'SC 3.1.2'], [EN, '9.3.1.2']),
  WCAG_326: r(['WCAG', 'SC 3.2.6'], [EN, '12.1.1']),
  WCAG_331: r(['WCAG', 'SC 3.3.1'], [EN, '9.3.3.1']),
  WCAG_332: r(['WCAG', 'SC 3.3.2'], [EN, '9.3.3.2']),
  WCAG_412: r(['WCAG', 'SC 4.1.2'], [EN, '9.4.1.2']),
  WCAG_413: r(['WCAG', 'SC 4.1.3'], [EN, '9.4.1.3']),
  EN_1211: r([EN, '12.1.1']),
  EAA_I3: r(['EAA', 'Annex I §I.3']),
} as const;

const ATTR_ARIA_DESCRIBEDBY = 'aria-describedby';
const ATTR_ARIA_LABEL = 'aria-label';
const ATTR_ARIA_LABELLEDBY = 'aria-labelledby';

// ---------------------------------------------------------------------------
// Utility: set a document-level feature flag
// ---------------------------------------------------------------------------

function setDocFlag(acc: FeatureSink, key: string): void {
  acc.set('', key, true);
}

function lowerText(value: string): string {
  return collapseWhitespace(stripHtmlTags(value)).toLowerCase();
}

function includesAny(value: string, terms: readonly string[]): boolean {
  const lower = value.toLowerCase();
  return terms.some((term) => lower.includes(term.toLowerCase()));
}

function attrEquals(attrs: string, name: string, expected: string): boolean {
  return (getHtmlAttribute(attrs, name)?.toLowerCase() ?? '') === expected;
}

function attrNumber(attrs: string, name: string): number | undefined {
  const value = getHtmlAttribute(attrs, name);
  if (value === undefined || value.trim() === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function hasDigit(value: string): boolean {
  for (const char of value) {
    if (char >= '0' && char <= '9') return true;
  }
  return false;
}

function hasNordicCharacter(value: string): boolean {
  for (const char of value) {
    if ('åäöøæÅÄÖØÆ'.includes(char)) return true;
  }
  return false;
}

function printableAsciiCount(value: string): number {
  let count = 0;
  for (const char of value) {
    if (char >= ' ' && char <= '~') count += 1;
  }
  return count;
}

function hasIsoDate(value: string): boolean {
  for (let index = 0; index <= value.length - 10; index += 1) {
    const slice = value.slice(index, index + 10);
    const hasYear = [...slice.slice(0, 4)].every((char) => char >= '0' && char <= '9');
    const hasMonth = [...slice.slice(5, 7)].every((char) => char >= '0' && char <= '9');
    const hasDay = [...slice.slice(8, 10)].every((char) => char >= '0' && char <= '9');
    if (hasYear && hasMonth && hasDay && slice.charAt(4) === '-' && slice.charAt(7) === '-') {
      return true;
    }
  }
  return false;
}

function wordCount(value: string): number {
  return collapseWhitespace(value).split(' ').filter((word) => word.length > 0).length;
}

function findFirstElementText(html: string, tagName: string): string | undefined {
  const body = extractFirstElementContent(html, tagName);
  return body === undefined ? undefined : lowerText(body);
}

function hasAriaName(attrs: string): boolean {
  return hasHtmlAttribute(attrs, ATTR_ARIA_LABEL) || hasHtmlAttribute(attrs, ATTR_ARIA_LABELLEDBY);
}

function labelFor(labels: readonly HtmlElementMatch[], inputId: string | undefined): HtmlElementMatch | undefined {
  if (inputId === undefined || inputId === '') return undefined;
  return labels.find(({ attrs }) => getHtmlAttribute(attrs, 'for') === inputId);
}

function inputById(inputs: readonly HtmlOpeningTagMatch[], inputId: string): HtmlOpeningTagMatch | undefined {
  return inputs.find(({ attrs }) => getHtmlAttribute(attrs, 'id') === inputId);
}

function viewportDirective(content: string, directive: string): string | undefined {
  for (const part of content.split(',')) {
    const [rawName, ...rawValue] = part.split('=');
    const name = rawName?.trim().toLowerCase();
    if (name !== directive) continue;
    return rawValue.join('=').trim().toLowerCase();
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Helper: detect Nordic-language page
// ---------------------------------------------------------------------------

function isNordicPage(html: string): boolean {
  const htmlTag = findHtmlOpeningTags(html, ['html'])[0];
  const lang = (getHtmlAttribute(htmlTag?.attrs ?? '', 'lang') ?? '').toLowerCase().split('-')[0] ?? '';
  return lang === 'sv' || lang === 'da' || lang === 'fi' || lang === 'nb' || lang === 'no' || lang === 'nn';
}

// ---------------------------------------------------------------------------
// Helper: detect accessibility statement page
// ---------------------------------------------------------------------------

function isStatementPage(html: string): boolean {
  const h1Text = findFirstElementText(html, 'h1') ?? '';
  if (
    (h1Text.includes('accessibility') && h1Text.includes('statement')) ||
    h1Text.includes('tillgänglighetsredogörelse') ||
    h1Text.includes('saavutettavuusseloste')
  ) {
    return true;
  }
  const titleText = findFirstElementText(html, 'title') ?? '';
  if (
    (titleText.includes('accessibility') && titleText.includes('statement')) ||
    (titleText.includes('a11y') && titleText.includes('statement'))
  ) {
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// perDocument extractors — grouped by rule pack
// ---------------------------------------------------------------------------

// eslint-disable-next-line sonarjs/cognitive-complexity -- EAA audiovisual rule pack mirrors the regulatory rule list; refactor deferred
function extractAudiovisual(html: string, acc: FeatureSink): void {
  // ariada/audiovisual/captions-track-has-src
  const trackTags = findHtmlOpeningTags(html, ['track']);
  for (const { attrs } of trackTags) {
    const kind = getHtmlAttribute(attrs, 'kind')?.toLowerCase() ?? '';
    if (kind === 'captions' || kind === 'subtitles') {
      const src = getHtmlAttribute(attrs, 'src') ?? '';
      if (src.trim() === '') {
        setDocFlag(acc, F.CAPTIONS_NO_SRC);
        break;
      }
    }
  }

  // ariada/audiovisual/media-element-has-accessible-name
  for (const { attrs } of findHtmlOpeningTags(html, ['audio', 'video'])) {
    if (!hasHtmlAttribute(attrs, 'controls')) continue;
    const hasName = hasAriaName(attrs) || hasHtmlAttribute(attrs, 'title');
    if (!hasName) {
      setDocFlag(acc, F.MEDIA_NO_NAME);
      break;
    }
  }

  // ariada/audiovisual/track-has-valid-kind
  const VALID_KINDS = new Set(['captions', 'subtitles', 'descriptions', 'chapters', 'metadata']);
  for (const { attrs } of trackTags) {
    const kind = getHtmlAttribute(attrs, 'kind')?.toLowerCase() ?? 'subtitles';
    if (!VALID_KINDS.has(kind)) {
      setDocFlag(acc, F.TRACK_INVALID_KIND);
      break;
    }
    if (kind === 'subtitles' && !hasHtmlAttribute(attrs, 'srclang')) {
      setDocFlag(acc, F.TRACK_INVALID_KIND);
      break;
    }
  }

  // ariada/audiovisual/video-has-audio-description-track
  for (const { attrs, body } of findHtmlElements(html, ['video'])) {
    if (!hasHtmlAttribute(attrs, 'controls')) continue;
    const hasDescTrack = findHtmlOpeningTags(body, ['track']).some(({ attrs: trackAttrs }) =>
      attrEquals(trackAttrs, 'kind', 'descriptions'),
    );
    const hasAriaDesc = hasHtmlAttribute(attrs, ATTR_ARIA_DESCRIBEDBY);
    if (!hasDescTrack && !hasAriaDesc) {
      setDocFlag(acc, F.VIDEO_NO_AUDIO_DESC);
      break;
    }
  }

  // ariada/audiovisual/video-has-captions-track
  for (const { attrs, body } of findHtmlElements(html, ['video'])) {
    if (hasHtmlAttribute(attrs, 'muted') && hasHtmlAttribute(attrs, 'autoplay')) continue;
    if (!hasHtmlAttribute(attrs, 'controls')) continue;
    const hasCaptionTrack = findHtmlOpeningTags(body, ['track']).some(({ attrs: trackAttrs }) => {
      const kind = getHtmlAttribute(trackAttrs, 'kind')?.toLowerCase() ?? '';
      return kind === 'captions' || kind === 'subtitles';
    });
    if (!hasCaptionTrack) {
      setDocFlag(acc, F.VIDEO_NO_CAPTIONS);
      break;
    }
  }
}

// eslint-disable-next-line sonarjs/cognitive-complexity -- EAA banking rule pack mirrors the regulatory rule list; refactor deferred
function extractBanking(html: string, acc: FeatureSink): void {
  // ariada/banking/2fa-keyboard-accessible
  // Group of ≥3 maxlength=1 inputs with a blocking attribute
  const inputTags = findHtmlOpeningTags(html, ['input']);
  const blockingOtpCount = inputTags.filter(({ attrs }) => {
    const maxLength = getHtmlAttribute(attrs, 'maxlength') === '1';
    const blocked =
      attrEquals(attrs, 'inputmode', 'none') ||
      getHtmlAttribute(attrs, 'tabindex') === '-1' ||
      hasHtmlAttribute(attrs, 'readonly');
    return maxLength && blocked;
  }).length;
  if (blockingOtpCount >= 3) {
    setDocFlag(acc, F.TWO_FA_NOT_KEYBOARD);
  }

  // ariada/banking/currency-format-readable
  // Scan inline elements (span, a, abbr) directly — they may be nested inside <p>
  // so we cannot rely on outer-element matching which catches <p> first.
  const currencyTerms = ['kr', 'sek', 'eur', 'gbp', 'usd', '€', '$', '£'] as const;
  const currencyClasses = ['balance', 'amount', 'price', 'cost', 'total'] as const;
  let currencyMissing = false;
  // First scan block-level elements (div/p/section) — catches elements with direct class
  for (const { attrs, body } of findHtmlElements(html, ['div', 'section', 'td'])) {
    if (!htmlAttributeIncludesAny(attrs, 'class', currencyClasses)) continue;
    const bodyText = lowerText(body);
    if (!includesAny(bodyText, currencyTerms) || !hasDigit(bodyText)) continue;
    const hasDataValue = findHtmlOpeningTags(body, ['data']).some(({ attrs: dataAttrs }) =>
      hasHtmlAttribute(dataAttrs, 'value'),
    ) || findHtmlOpeningTags(body, ['output']).length > 0;
    const hasAriaLabel = hasHtmlAttribute(attrs, ATTR_ARIA_LABEL);
    if (!hasDataValue && !hasAriaLabel) {
      setDocFlag(acc, F.CURRENCY_NO_MACHINE);
      currencyMissing = true;
      break;
    }
  }
  // Also scan inline elements (span) directly — they may not match above if nested in <p>
  if (!currencyMissing) {
    for (const { attrs, body } of findHtmlElements(html, ['span'])) {
      if (!htmlAttributeIncludesAny(attrs, 'class', currencyClasses)) continue;
      const bodyText = lowerText(body);
      if (!includesAny(bodyText, currencyTerms) || !hasDigit(bodyText)) continue;
      const hasAriaLabel = hasHtmlAttribute(attrs, ATTR_ARIA_LABEL);
      if (!hasAriaLabel) {
        setDocFlag(acc, F.CURRENCY_NO_MACHINE);
        break;
      }
    }
  }

  // ariada/banking/date-format-locale
  const dateNames = ['date', 'datum', 'dag', 'dato', 'päivä'] as const;
  for (const { attrs } of inputTags) {
    if (!htmlAttributeIncludesAny(attrs, 'name', dateNames)) continue;
    const placeholder = getHtmlAttribute(attrs, 'placeholder') ?? '';
    const digitCount = placeholder.split('').filter((char) => char >= '0' && char <= '9').length;
    const hasFormatHint = includesAny(placeholder, ['mm', 'dd', 'yyyy', 'yy', 'åå']) || digitCount >= 4;
    const hasAriaDesc = hasHtmlAttribute(attrs, ATTR_ARIA_DESCRIBEDBY);
    if (!hasFormatHint && !hasAriaDesc) {
      setDocFlag(acc, F.DATE_NO_FORMAT);
      break;
    }
  }

  // ariada/banking/iban-input-format
  for (const { attrs } of inputTags) {
    const isIbanInput =
      htmlAttributeIncludesAny(attrs, 'name', ['iban']) ||
      htmlAttributeIncludesAny(attrs, 'id', ['iban']) ||
      htmlAttributeIncludesAny(attrs, ATTR_ARIA_LABEL, ['iban']);
    if (!isIbanInput) continue;
    const placeholder = (getHtmlAttribute(attrs, 'placeholder') ?? '').replaceAll(' ', '').toUpperCase();
    const hasIbanExample =
      placeholder.length >= 8 &&
      placeholder.charAt(0) >= 'A' &&
      placeholder.charAt(0) <= 'Z' &&
      placeholder.charAt(1) >= 'A' &&
      placeholder.charAt(1) <= 'Z' &&
      placeholder.charAt(2) >= '0' &&
      placeholder.charAt(2) <= '9' &&
      placeholder.charAt(3) >= '0' &&
      placeholder.charAt(3) <= '9';
    const hasAriaDesc = hasHtmlAttribute(attrs, ATTR_ARIA_DESCRIBEDBY);
    if (!hasIbanExample && !hasAriaDesc) {
      setDocFlag(acc, F.IBAN_NO_FORMAT);
      break;
    }
  }

  // ariada/banking/lang-matches-locale
  const pageLang = (getHtmlAttribute(findHtmlOpeningTags(html, ['html'])[0]?.attrs ?? '', 'lang') ?? '')
    .toLowerCase()
    .split('-')[0] ?? '';
  const bodyText = extractFirstElementContent(html, 'body') ?? html;
  if (pageLang === 'en' && hasNordicCharacter(bodyText)) {
    setDocFlag(acc, F.LANG_MISMATCH);
  }

  // ariada/banking/locale-fallback
  if (isNordicPage(html)) {
    for (const { attrs, body } of findHtmlElements(html, ['p'])) {
      const pText = stripHtmlTags(body).trim();
      if (pText.length < 80 || hasHtmlAttribute(attrs, 'lang')) continue;
      if (hasNordicCharacter(pText)) continue;
      const asciiRatio = printableAsciiCount(pText) / pText.length;
      if (asciiRatio > 0.85) {
        setDocFlag(acc, F.LOCALE_FALLBACK);
        break;
      }
    }
  }

  // ariada/banking/login-error-not-blocking
  const titleText = findFirstElementText(html, 'title') ?? '';
  const isLoginPage =
    includesAny(titleText, ['login', 'log in', 'sign in', 'logga in']) ||
    inputTags.some(({ attrs }) => attrEquals(attrs, 'type', 'password'));
  if (isLoginPage) {
    for (const { attrs, body } of findHtmlElements(html, ['div'])) {
      const content = stripHtmlTags(body).trim();
      if (content.length === 0) continue;
      if (!htmlAttributeIncludesAny(attrs, 'class', ['error']) && !attrEquals(attrs, 'role', 'alert')) continue;
      const hasLive = hasHtmlAttribute(attrs, 'aria-live') || attrEquals(attrs, 'role', 'alert');
      if (!hasLive) {
        setDocFlag(acc, F.LOGIN_ERROR_NO_LIVE);
        break;
      }
    }
  }

  // ariada/banking/numeric-validation-error-locale
  if (isNordicPage(html)) {
    for (const { attrs, body } of findHtmlElements(html, ['div', 'span', 'p'])) {
      const content = stripHtmlTags(body).trim();
      if (content.length < 10) continue;
      if (!htmlAttributeIncludesAny(attrs, 'class', ['error']) && !attrEquals(attrs, 'role', 'alert')) continue;
      if (!hasNordicCharacter(content)) {
        setDocFlag(acc, F.NUMERIC_ERROR_LOCALE);
        break;
      }
    }
  }

  // ariada/banking/session-timeout-warning
  for (const { attrs, body } of findHtmlElements(html, ['div', 'section', 'aside'])) {
    if (!attrEquals(attrs, 'role', 'alertdialog')) continue;
    if (!htmlAttributeIncludesAny(attrs, 'class', ['session', 'timeout', 'inactivity'])) continue;
    const hasExtendBtn = findHtmlElements(body, ['button']).some(({ body: buttonBody }) =>
      includesAny(lowerText(buttonBody), ['extend', 'continue', 'resume', 'stay', 'keep']),
    );
    if (!hasExtendBtn) {
      setDocFlag(acc, F.SESSION_TIMEOUT_NO_EXTEND);
      break;
    }
  }

  // ariada/banking/transaction-amount-input
  const amountNames = ['amount', 'belopp', 'belop', 'sum', 'betalning'] as const;
  for (const { attrs } of inputTags) {
    if (!htmlAttributeIncludesAny(attrs, 'name', amountNames)) continue;
    const inputmode = getHtmlAttribute(attrs, 'inputmode')?.toLowerCase() ?? '';
    const hasInputmode = inputmode === 'decimal' || inputmode === 'numeric';
    const ariaLabel = getHtmlAttribute(attrs, ATTR_ARIA_LABEL) ?? '';
    const hasCurrencyInName = includesAny(ariaLabel, ['sek', 'eur', 'gbp', 'usd', 'kr', 'euro', 'kronor']);
    if (!hasCurrencyInName) {
      setDocFlag(acc, F.AMOUNT_INPUT_NO_FORMAT);
      break;
    }
    void hasInputmode; // covered above; currency check is the deciding axis
  }
}

// eslint-disable-next-line sonarjs/cognitive-complexity -- EAA checkout rule pack mirrors the regulatory rule list; refactor deferred
function extractCheckout(html: string, acc: FeatureSink): void {
  const inputTags = findHtmlOpeningTags(html, ['input']);
  const labelElements = findHtmlElements(html, ['label']);
  const formElements = findHtmlElements(html, ['form']);
  const checkoutTerms = ['checkout', 'cart', 'payment', 'order', 'shipping'] as const;
  const isCheckoutForm = (attrs: string): boolean =>
    htmlAttributeIncludesAny(attrs, 'class', checkoutTerms) || htmlAttributeIncludesAny(attrs, 'id', checkoutTerms);

  // ariada/checkout/autocomplete-personal-data
  const personalNameTerms = ['email', 'phone', 'tel', 'firstname', 'lastname', 'first.name', 'last.name', 'address', 'zip', 'postal', 'city'] as const;
  for (const { attrs } of inputTags) {
    const name = getHtmlAttribute(attrs, 'name') ?? '';
    if (!includesAny(name, personalNameTerms)) continue;
    const autocomplete = getHtmlAttribute(attrs, 'autocomplete') ?? '';
    if (!autocomplete || autocomplete === 'off') {
      setDocFlag(acc, F.NO_AUTOCOMPLETE);
      break;
    }
  }

  // ariada/checkout/cart-quantity-input-label
  const qtyNameTerms = ['qty', 'quantity', 'antal', 'menge'] as const;
  for (const { attrs } of inputTags) {
    const name = getHtmlAttribute(attrs, 'name') ?? '';
    if (!includesAny(name, qtyNameTerms)) continue;
    const ariaLabel = getHtmlAttribute(attrs, ATTR_ARIA_LABEL) ?? '';
    if (ariaLabel && wordCount(ariaLabel) <= 1) {
      setDocFlag(acc, F.QTY_VAGUE_LABEL);
      break;
    }
    if (!ariaLabel && !hasHtmlAttribute(attrs, ATTR_ARIA_LABELLEDBY)) {
      const labelText = lowerText(labelFor(labelElements, getHtmlAttribute(attrs, 'id'))?.body ?? '');
      if (labelText && wordCount(labelText) <= 1) {
        setDocFlag(acc, F.QTY_VAGUE_LABEL);
        break;
      }
    }
  }

  // ariada/checkout/cart-update-live-region
  for (const { attrs } of findHtmlElements(html, ['div', 'section', 'aside'])) {
    const className = getHtmlAttribute(attrs, 'class')?.toLowerCase() ?? '';
    const looksLikeCart =
      className.includes('cart-summary') ||
      (className.includes('cart') && className.includes('total')) ||
      (className.includes('order') && className.includes('summary'));
    if (!looksLikeCart) continue;
    const hasLive =
      hasHtmlAttribute(attrs, 'aria-live') ||
      ['status', 'region', 'alert'].includes(getHtmlAttribute(attrs, 'role')?.toLowerCase() ?? '');
    if (!hasLive) {
      setDocFlag(acc, F.CART_NO_LIVE);
      break;
    }
  }

  // ariada/checkout/discount-code-feedback
  const couponNameTerms = ['promo', 'coupon', 'discount', 'code', 'voucher'] as const;
  for (const { attrs } of inputTags) {
    const name = getHtmlAttribute(attrs, 'name') ?? '';
    if (!includesAny(name, couponNameTerms)) continue;
    if (!hasHtmlAttribute(attrs, ATTR_ARIA_DESCRIBEDBY)) {
      setDocFlag(acc, F.COUPON_NO_FEEDBACK);
      break;
    }
  }

  // ariada/checkout/error-identification
  for (const { attrs, body } of findHtmlElements(html, ['div', 'span', 'p'])) {
    const content = stripHtmlTags(body).trim();
    if (!htmlAttributeIncludesAny(attrs, 'class', ['error']) || content.length === 0) continue;
    const hasAnnounce = hasHtmlAttribute(attrs, 'aria-live') || attrEquals(attrs, 'role', 'alert');
    if (!hasAnnounce) {
      setDocFlag(acc, F.ERROR_NO_ANNOUNCE);
      break;
    }
  }

  // ariada/checkout/form-label-association
  const ignoredInputTypes = new Set(['hidden', 'submit', 'button', 'reset', 'image']);
  for (const { attrs: formAttrs, body: formBody } of formElements) {
    if (!isCheckoutForm(formAttrs)) continue;
    for (const { attrs } of findHtmlOpeningTags(formBody, ['input'])) {
      const inputType = getHtmlAttribute(attrs, 'type')?.toLowerCase() ?? 'text';
      if (ignoredInputTypes.has(inputType)) continue;
      const hasLabel = labelFor(labelElements, getHtmlAttribute(attrs, 'id')) !== undefined;
      if (!hasAriaName(attrs) && !hasLabel) {
        setDocFlag(acc, F.INPUT_NO_LABEL);
        break;
      }
    }
  }

  // ariada/checkout/order-confirmation-focus
  const confirmationHeading = findHtmlElements(html, ['h1', 'h2']).find(({ body }) =>
    includesAny(lowerText(body), ['thank you', 'order confirmed', 'order placed']),
  );
  if (confirmationHeading !== undefined) {
    const hasFocus = hasHtmlAttribute(confirmationHeading.attrs, 'autofocus') || attrNumber(confirmationHeading.attrs, 'tabindex') !== undefined;
    if (!hasFocus) {
      setDocFlag(acc, F.CONFIRM_NO_FOCUS);
    }
  }

  // ariada/checkout/payment-fieldset-grouping
  // Collect all payment-radio name groups; each group of ≥2 must be inside a fieldset.
  // Global hasFieldset is wrong when BOTH passing and failing groups exist — check per name-group.
  {
    const radioGroupNames = new Map<string, number>();
    for (const { attrs } of inputTags) {
      if (!attrEquals(attrs, 'type', 'radio')) continue;
      const name = (getHtmlAttribute(attrs, 'name') ?? '').toLowerCase();
      if (!name.includes('payment') && !name.includes('pay-') && !name.includes('pay_')) continue;
      radioGroupNames.set(name, (radioGroupNames.get(name) ?? 0) + 1);
    }
    const fieldsets = findHtmlElements(html, ['fieldset']);
    for (const [groupName, count] of radioGroupNames) {
      if (count < 2) continue;
      const inFieldset = fieldsets.some(({ body }) =>
        findHtmlOpeningTags(body, ['input']).some(({ attrs }) =>
          attrEquals(attrs, 'type', 'radio') && (getHtmlAttribute(attrs, 'name') ?? '').toLowerCase() === groupName,
        ),
      );
      if (!inFieldset) {
        setDocFlag(acc, F.PAYMENT_NO_FIELDSET);
        break;
      }
    }
  }

  // ariada/checkout/required-field-machine-readable
  for (const { attrs: labelAttrs, body } of labelElements) {
    const labelText = lowerText(body);
    if (!labelText.includes('*') && !labelText.includes('required')) continue;
    const forAttr = getHtmlAttribute(labelAttrs, 'for');
    if (!forAttr) continue;
    const inputAttrs = inputById(inputTags, forAttr)?.attrs;
    if (inputAttrs === undefined) continue;
    const hasMachineRequired = hasHtmlAttribute(inputAttrs, 'required') || attrEquals(inputAttrs, 'aria-required', 'true');
    if (!hasMachineRequired) {
      setDocFlag(acc, F.REQUIRED_NOT_MACHINE);
      break;
    }
  }

  // ariada/checkout/step-keyboard-accessible
  // Scan for step-like opening tags directly (attribute-only regex, not balanced-tag matching)
  // because <div class="checkout-step"> may be nested inside <li>, causing the <li> match
  // to consume the inner <div> before it is independently seen.
  for (const { attrs, tagName } of findHtmlOpeningTags(html)) {
    const looksLikeStep =
      htmlAttributeIncludesAny(attrs, 'class', ['checkout-step', 'checkout_step', 'wizard-step', 'stepper-step']) ||
      htmlAttributeIncludesAny(attrs, 'data-role', ['step', 'wizard']);
    if (!looksLikeStep) continue;
    const isClickable = hasHtmlAttribute(attrs, 'onclick') || attrEquals(attrs, 'role', 'button');
    if (!isClickable) continue;
    const nativeInteractive = tagName === 'a' || tagName === 'button' || tagName === 'input' || tagName === 'select';
    const tabindex = attrNumber(attrs, 'tabindex');
    const hasTabindex = tabindex !== undefined && tabindex >= 0;
    if (!nativeInteractive && !hasTabindex) {
      setDocFlag(acc, F.STEP_NOT_FOCUSABLE);
      break;
    }
  }

  // ariada/checkout/submit-button-accessible-name
  const VAGUE_LABELS = new Set(['submit', 'continue', 'next', 'go', 'ok', 'send']);
  for (const { attrs: formAttrs, body: formBody } of formElements) {
    if (!isCheckoutForm(formAttrs)) continue;
    for (const { body } of findHtmlElements(formBody, ['button'])) {
      const btnText = lowerText(body);
      if (VAGUE_LABELS.has(btnText)) {
        setDocFlag(acc, F.SUBMIT_VAGUE);
        break;
      }
    }
  }
}

// eslint-disable-next-line sonarjs/cognitive-complexity -- EAA e-books rule pack mirrors the regulatory rule list; refactor deferred
function extractEbooks(html: string, acc: FeatureSink): void {
  // ariada/ebooks/audio-control-on-autoplay
  for (const { attrs } of findHtmlOpeningTags(html, ['audio', 'video'])) {
    if (!hasHtmlAttribute(attrs, 'autoplay')) continue;
    if (!hasHtmlAttribute(attrs, 'muted') && !hasHtmlAttribute(attrs, 'controls')) {
      setDocFlag(acc, F.AUTOPLAY_NO_CONTROL);
      break;
    }
  }

  // ariada/ebooks/no-positive-tabindex-in-reading
  for (const { body } of findHtmlElements(html, ['article'])) {
    if (findHtmlOpeningTags(body).some(({ attrs }) => (attrNumber(attrs, 'tabindex') ?? 0) > 0)) {
      setDocFlag(acc, F.POSITIVE_TABINDEX);
      break;
    }
  }
  if (!html.includes('a11y:positive-tabindex')) { // only if not already set via article
    for (const { attrs, body } of findHtmlElements(html, ['article', 'div', 'main', 'section'])) {
      if (!hasHtmlAttribute(attrs, 'data-reading-content')) continue;
      if (findHtmlOpeningTags(body).some(({ attrs: nestedAttrs }) => (attrNumber(nestedAttrs, 'tabindex') ?? 0) > 0)) {
        setDocFlag(acc, F.POSITIVE_TABINDEX);
        break;
      }
    }
  }

  // ariada/ebooks/reading-content-has-lang
  for (const { attrs, tagName } of findHtmlOpeningTags(html, ['article', 'div'])) {
    const isReadingArea = tagName === 'article' || attrEquals(attrs, 'role', 'document');
    if (!isReadingArea) continue;
    const hasValidLang = (getHtmlAttribute(attrs, 'lang') ?? '').trim().length > 0;
    if (!hasValidLang) {
      setDocFlag(acc, F.READING_NO_LANG);
      break;
    }
  }

  // ariada/ebooks/text-spacing-overridable
  const textSpacingProps = ['line-height', 'letter-spacing', 'word-spacing', 'text-indent'];
  for (const { attrs } of findHtmlOpeningTags(html)) {
    const styleVal = getHtmlAttribute(attrs, 'style') ?? '';
    if (styleVal.includes('!important')) {
      for (const prop of textSpacingProps) {
        if (styleVal.includes(prop)) {
          setDocFlag(acc, F.TEXT_SPACING_IMPORTANT);
          break;
        }
      }
    }
  }

  // ariada/ebooks/viewport-allows-zoom
  // Scan ALL viewport meta tags (not just first) — fixture may have a passing meta in <head>
  // and a failing meta later in the document.
  for (const { attrs } of findHtmlOpeningTags(html, ['meta'])) {
    const isViewport =
      attrEquals(attrs, 'name', 'viewport') ||
      includesAny(getHtmlAttribute(attrs, 'content') ?? '', ['width=device-width', 'initial-scale']);
    if (!isViewport) continue;
    const viewportContent = getHtmlAttribute(attrs, 'content') ?? '';
    if (!viewportContent) continue;
    if (viewportDirective(viewportContent, 'user-scalable') === 'no') {
      setDocFlag(acc, F.VIEWPORT_BLOCKS_ZOOM);
      break;
    }
    const maxScale = Number(viewportDirective(viewportContent, 'maximum-scale') ?? '5');
    if (Number.isFinite(maxScale) && maxScale < 2.0) {
      setDocFlag(acc, F.VIEWPORT_BLOCKS_ZOOM);
      break;
    }
  }
}

function extractStatement(html: string, acc: FeatureSink): void {
  // These rules apply to ALL pages — but only when the page has navigable structure.
  // A page with no <nav>, <main>, or <header> is a fragment/component and should not fire.
  const openingTags = findHtmlOpeningTags(html);
  const links = findHtmlElements(html, ['a']);
  const pageText = lowerText(html);
  const hasNavigableStructure =
    openingTags.some(({ tagName }) => tagName === 'nav' || tagName === 'main' || tagName === 'header' || tagName === 'footer') ||
    openingTags.some(({ attrs }) => ['navigation', 'main', 'banner', 'contentinfo'].includes(getHtmlAttribute(attrs, 'role')?.toLowerCase() ?? ''));

  if (hasNavigableStructure) {
    // ariada/statement/page-link-from-footer — applies to ALL pages with navigation
    const hasA11yLink = links.some(({ attrs }) => {
      const href = getHtmlAttribute(attrs, 'href')?.toLowerCase() ?? '';
      return href.includes('accessibility') || href.includes('a11y') || href.includes('saavutettav') || (href.includes('tillg') && href.includes('nglighet'));
    });
    if (!hasA11yLink) {
      setDocFlag(acc, F.FOOTER_NO_A11Y_LINK);
    }

    // ariada/statement/skip-link-from-every-page — applies to ALL pages with navigation
    const hasSkipLink = links.some(({ attrs, body }) =>
      (getHtmlAttribute(attrs, 'href') ?? '').startsWith('#') &&
      includesAny(lowerText(body), ['skip', 'hoppa', 'skippe', 'ohita', 'passer', 'hyppää']),
    );
    if (!hasSkipLink) {
      setDocFlag(acc, F.NO_SKIP_LINK);
    }
  }

  // All remaining statement rules apply only on statement pages
  if (!isStatementPage(html)) return;

  // ariada/statement/conformance-level-declared
  const hasConformance =
    (pageText.includes('wcag 2.') && pageText.includes('level a')) ||
    includesAny(pageText, ['fully conformant', 'partially conformant', 'non-conformant', 'non conformant']);
  if (!hasConformance) {
    setDocFlag(acc, F.STATEMENT_NO_CONFORMANCE);
  }

  // ariada/statement/enforcement-procedure-link
  const hasEnforcement =
    links.some(({ attrs }) => includesAny(getHtmlAttribute(attrs, 'href') ?? '', ['do.se', 'digg.se', 'gov.uk/guidance', 'just.fvst', 'msb.se', 'myndigheten'])) ||
    includesAny(pageText, ['enforcement procedure', 'national authority', 'tillsynsmyndighet', 'klagomålshantering']);
  if (!hasEnforcement) {
    setDocFlag(acc, F.STATEMENT_NO_ENFORCEMENT);
  }

  // ariada/statement/feedback-mechanism-present
  const hasFeedback = links.some(({ attrs }) => {
    const href = getHtmlAttribute(attrs, 'href')?.toLowerCase() ?? '';
    return href.startsWith('mailto:') || href.startsWith('tel:') || includesAny(href, ['contact', 'kontakt', 'feedback', 'report', 'palaute']);
  });
  if (!hasFeedback) {
    setDocFlag(acc, F.STATEMENT_NO_FEEDBACK);
  }

  // ariada/statement/last-revision-date
  if (!includesAny(pageText, ['last updated', 'last reviewed', 'last revised', 'senast uppdaterad', 'senast reviderad', 'päivitetty'])) {
    setDocFlag(acc, F.STATEMENT_NO_LAST_REVISION);
  }

  // ariada/statement/methodology-disclosed
  if (!includesAny(pageText, ['self-assessment', 'self assessment', 'external audit', 'user testing', 'testing methodology', 'testmetod', 'självskattning', 'assessment approach'])) {
    setDocFlag(acc, F.STATEMENT_NO_METHODOLOGY);
  }

  // ariada/statement/non-conformance-items-listed
  if (includesAny(pageText, ['partially conformant', 'non-conformant', 'non conformant'])) {
    const hasListContainer = findHtmlOpeningTags(html, ['ul', 'ol']).length > 0;
    const hasListOfItems = hasListContainer && findHtmlElements(html, ['li']).some(({ body }) => lowerText(body).length >= 10);
    if (!hasListOfItems) {
      setDocFlag(acc, F.STATEMENT_NO_NONCONFORMANCE);
    }
  }

  // ariada/statement/publication-date-present
  if (!findHtmlOpeningTags(html, ['time']).some(({ attrs }) => hasIsoDate(getHtmlAttribute(attrs, 'datetime') ?? ''))) {
    setDocFlag(acc, F.STATEMENT_NO_PUBDATE);
  }

  // ariada/statement/standard-reference
  if (!includesAny(pageText, ['wcag 2.', 'en 301 549', 'web content accessibility guidelines'])) {
    setDocFlag(acc, F.STATEMENT_NO_STANDARD);
  }
}

// eslint-disable-next-line sonarjs/cognitive-complexity -- EAA transport rule pack mirrors the regulatory rule list; refactor deferred
function extractTransport(html: string, acc: FeatureSink): void {
  const labelElements = findHtmlElements(html, ['label']);
  const describedElements = findHtmlElements(html, ['div', 'span', 'p', 'small', 'output', 'section', 'aside']);

  // ariada/transport/booking-timeout-has-warning
  for (const { attrs } of findHtmlOpeningTags(html)) {
    if (!hasHtmlAttribute(attrs, 'data-booking-timeout')) continue;
    const hasWarning = hasHtmlAttribute(attrs, 'data-timeout-warning');
    const ariaDesc = getHtmlAttribute(attrs, ATTR_ARIA_DESCRIBEDBY);
    if (!hasWarning && !ariaDesc) {
      setDocFlag(acc, F.BOOKING_NO_TIMEOUT_WARN);
      break;
    }
    if (ariaDesc) {
      const ref = describedElements.find(({ attrs: refAttrs }) => getHtmlAttribute(refAttrs, 'id') === ariaDesc);
      if (ref !== undefined && lowerText(ref.body) === '') {
        setDocFlag(acc, F.BOOKING_NO_TIMEOUT_WARN);
        break;
      }
    }
  }

  // ariada/transport/fare-table-has-caption
  for (const { attrs, body } of findHtmlElements(html, ['table'])) {
    if (!hasHtmlAttribute(attrs, 'data-fare-table')) continue;
    const caption = findHtmlElements(body, ['caption'])[0];
    if (caption === undefined || lowerText(caption.body) === '') {
      setDocFlag(acc, F.FARE_TABLE_NO_CAPTION);
      break;
    }
  }

  // ariada/transport/live-status-has-live-region
  for (const { attrs } of findHtmlOpeningTags(html)) {
    if (!hasHtmlAttribute(attrs, 'data-live-status')) continue;
    const ariaLive = getHtmlAttribute(attrs, 'aria-live') ?? '';
    const hasValidLive = ariaLive === 'polite' || ariaLive === 'assertive';
    const hasRole = attrEquals(attrs, 'role', 'status') || attrEquals(attrs, 'role', 'alert');
    if (!hasValidLive && !hasRole) {
      setDocFlag(acc, F.LIVE_STATUS_NO_LIVE);
      break;
    }
  }

  // ariada/transport/seat-selection-has-accessible-name
  for (const { attrs: containerAttrs, body } of findHtmlElements(html, ['div', 'section', 'ul', 'nav', 'main', 'article'])) {
    if (!hasHtmlAttribute(containerAttrs, 'data-seat-map')) continue;

    for (const { attrs, body: buttonBody } of findHtmlElements(body, ['button'])) {
      const btnText = lowerText(buttonBody);
      if (!btnText && !hasAriaName(attrs)) {
        setDocFlag(acc, F.SEAT_NO_NAME);
        break;
      }
    }

    for (const { attrs } of findHtmlOpeningTags(body, ['input'])) {
      const inputType = getHtmlAttribute(attrs, 'type')?.toLowerCase() ?? 'text';
      if (inputType !== 'checkbox' && inputType !== 'radio') continue;
      const hasLabel = labelFor(labelElements, getHtmlAttribute(attrs, 'id')) !== undefined;
      if (!hasAriaName(attrs) && !hasLabel) {
        setDocFlag(acc, F.SEAT_NO_NAME);
        break;
      }
    }
  }

  // ariada/transport/timetable-has-header-cells
  for (const { attrs, body } of findHtmlElements(html, ['table'])) {
    if (!hasHtmlAttribute(attrs, 'data-timetable')) continue;
    if (findHtmlOpeningTags(body, ['th']).length === 0) {
      setDocFlag(acc, F.TIMETABLE_NO_HEADERS);
      break;
    }
  }
}

// ---------------------------------------------------------------------------
// Rule catalogue
// ---------------------------------------------------------------------------

interface RuleSpec {
  ruleId: string;
  severity: Finding['severity'];
  message: string;
  wcag: string[];
  regulatory: readonly RegulatoryRef[];
}

const DOC_RULE_SPECS: Record<string, RuleSpec> = {
  [F.CAPTIONS_NO_SRC]: { ruleId: 'ariada/audiovisual/captions-track-has-src', severity: 'serious', message: 'Captions or subtitles track has no src attribute', wcag: ['1.2.2'], regulatory: REG.WCAG_122 },
  [F.MEDIA_NO_NAME]: { ruleId: 'ariada/audiovisual/media-element-has-accessible-name', severity: 'serious', message: 'Video or audio element with controls has no accessible name', wcag: ['1.1.1', '4.1.2'], regulatory: [...REG.WCAG_111, ...REG.WCAG_412] },
  [F.TRACK_INVALID_KIND]: { ruleId: 'ariada/audiovisual/track-has-valid-kind', severity: 'minor', message: 'Track element has invalid kind or subtitles track missing srclang', wcag: ['1.2.2'], regulatory: REG.WCAG_122 },
  [F.VIDEO_NO_AUDIO_DESC]: { ruleId: 'ariada/audiovisual/video-has-audio-description-track', severity: 'moderate', message: 'Video has no audio description track and no aria-describedby', wcag: ['1.2.5'], regulatory: REG.WCAG_125 },
  [F.VIDEO_NO_CAPTIONS]: { ruleId: 'ariada/audiovisual/video-has-captions-track', severity: 'serious', message: 'Video element with controls has no captions or subtitles track', wcag: ['1.2.2'], regulatory: REG.WCAG_122 },

  [F.TWO_FA_NOT_KEYBOARD]: { ruleId: 'ariada/banking/2fa-keyboard-accessible', severity: 'critical', message: '2FA OTP inputs are not keyboard-accessible', wcag: ['2.1.1'], regulatory: REG.WCAG_211 },
  [F.CURRENCY_NO_MACHINE]: { ruleId: 'ariada/banking/currency-format-readable', severity: 'minor', message: 'Currency value is not machine-readable', wcag: ['1.3.1'], regulatory: REG.WCAG_131 },
  [F.DATE_NO_FORMAT]: { ruleId: 'ariada/banking/date-format-locale', severity: 'moderate', message: 'Date input has no locale-appropriate format hint', wcag: ['3.3.2'], regulatory: REG.WCAG_332 },
  [F.IBAN_NO_FORMAT]: { ruleId: 'ariada/banking/iban-input-format', severity: 'moderate', message: 'IBAN input has no example or description of the expected format', wcag: ['3.3.2'], regulatory: REG.WCAG_332 },
  [F.LANG_MISMATCH]: { ruleId: 'ariada/banking/lang-matches-locale', severity: 'serious', message: 'html[lang] does not match the language of the page content', wcag: ['3.1.1'], regulatory: REG.WCAG_311 },
  [F.LOCALE_FALLBACK]: { ruleId: 'ariada/banking/locale-fallback', severity: 'moderate', message: 'Long foreign-language text block has no lang attribute to override page locale', wcag: ['3.1.2'], regulatory: REG.WCAG_312 },
  [F.LOGIN_ERROR_NO_LIVE]: { ruleId: 'ariada/banking/login-error-not-blocking', severity: 'serious', message: 'Login error message is not announced to assistive technology', wcag: ['3.3.1', '4.1.3'], regulatory: [...REG.WCAG_331, ...REG.WCAG_413] },
  [F.NUMERIC_ERROR_LOCALE]: { ruleId: 'ariada/banking/numeric-validation-error-locale', severity: 'moderate', message: 'Validation error is in English on a Nordic-language page', wcag: ['3.1.1'], regulatory: REG.WCAG_311 },
  [F.SESSION_TIMEOUT_NO_EXTEND]: { ruleId: 'ariada/banking/session-timeout-warning', severity: 'serious', message: 'Session timeout dialog has no button to extend or continue the session', wcag: ['2.2.1'], regulatory: REG.WCAG_221 },
  [F.AMOUNT_INPUT_NO_FORMAT]: { ruleId: 'ariada/banking/transaction-amount-input', severity: 'serious', message: 'Amount input missing currency indicator in accessible name', wcag: ['3.3.2'], regulatory: REG.WCAG_332 },

  [F.NO_AUTOCOMPLETE]: { ruleId: 'ariada/checkout/autocomplete-personal-data', severity: 'moderate', message: 'Personal data input is missing an autocomplete attribute', wcag: ['1.3.5'], regulatory: REG.WCAG_135 },
  [F.QTY_VAGUE_LABEL]: { ruleId: 'ariada/checkout/cart-quantity-input-label', severity: 'moderate', message: 'Quantity input has a vague label that does not identify which product it controls', wcag: ['3.3.2'], regulatory: REG.WCAG_332 },
  [F.CART_NO_LIVE]: { ruleId: 'ariada/checkout/cart-update-live-region', severity: 'serious', message: 'Cart summary region has no live region to announce updates', wcag: ['4.1.3'], regulatory: REG.WCAG_413 },
  [F.COUPON_NO_FEEDBACK]: { ruleId: 'ariada/checkout/discount-code-feedback', severity: 'moderate', message: 'Discount code input has no aria-describedby pointing to feedback', wcag: ['3.3.1'], regulatory: REG.WCAG_331 },
  [F.ERROR_NO_ANNOUNCE]: { ruleId: 'ariada/checkout/error-identification', severity: 'serious', message: 'Error element has non-empty text but no live region or role=alert', wcag: ['3.3.1', '4.1.3'], regulatory: [...REG.WCAG_331, ...REG.WCAG_413] },
  [F.INPUT_NO_LABEL]: { ruleId: 'ariada/checkout/form-label-association', severity: 'serious', message: 'Form input inside checkout form has no programmatically associated label', wcag: ['3.3.2', '4.1.2'], regulatory: [...REG.WCAG_332, ...REG.WCAG_412] },
  [F.CONFIRM_NO_FOCUS]: { ruleId: 'ariada/checkout/order-confirmation-focus', severity: 'serious', message: 'Order confirmation heading has no autofocus or tabindex to direct keyboard focus', wcag: ['2.4.3'], regulatory: REG.WCAG_243 },
  [F.PAYMENT_NO_FIELDSET]: { ruleId: 'ariada/checkout/payment-fieldset-grouping', severity: 'serious', message: 'Payment method radio inputs are not grouped in a fieldset', wcag: ['1.3.1', '3.3.2'], regulatory: [...REG.WCAG_131, ...REG.WCAG_332] },
  [F.REQUIRED_NOT_MACHINE]: { ruleId: 'ariada/checkout/required-field-machine-readable', severity: 'moderate', message: 'Field visually marked required but missing required or aria-required attribute', wcag: ['3.3.2'], regulatory: REG.WCAG_332 },
  [F.STEP_NOT_FOCUSABLE]: { ruleId: 'ariada/checkout/step-keyboard-accessible', severity: 'serious', message: 'Checkout step element is clickable but not keyboard-focusable', wcag: ['2.1.1'], regulatory: REG.WCAG_211 },
  [F.SUBMIT_VAGUE]: { ruleId: 'ariada/checkout/submit-button-accessible-name', severity: 'serious', message: 'Submit button in checkout form has a vague accessible name', wcag: ['2.4.6'], regulatory: REG.WCAG_246 },

  [F.AUTOPLAY_NO_CONTROL]: { ruleId: 'ariada/ebooks/audio-control-on-autoplay', severity: 'serious', message: 'Media element uses autoplay without muted or controls', wcag: ['1.4.2'], regulatory: REG.WCAG_142 },
  [F.POSITIVE_TABINDEX]: { ruleId: 'ariada/ebooks/no-positive-tabindex-in-reading', severity: 'moderate', message: 'Reading content area has an element with positive tabindex', wcag: ['2.4.3'], regulatory: REG.WCAG_243 },
  [F.READING_NO_LANG]: { ruleId: 'ariada/ebooks/reading-content-has-lang', severity: 'serious', message: 'Reading content area has no lang attribute', wcag: ['3.1.1'], regulatory: REG.WCAG_311 },
  [F.TEXT_SPACING_IMPORTANT]: { ruleId: 'ariada/ebooks/text-spacing-overridable', severity: 'serious', message: 'Inline style uses !important on a text-spacing property', wcag: ['1.4.12'], regulatory: REG.WCAG_1412 },
  [F.VIEWPORT_BLOCKS_ZOOM]: { ruleId: 'ariada/ebooks/viewport-allows-zoom', severity: 'serious', message: 'Viewport meta tag disables user zoom', wcag: ['1.4.4'], regulatory: REG.WCAG_144 },

  [F.STATEMENT_NO_CONFORMANCE]: { ruleId: 'ariada/statement/conformance-level-declared', severity: 'moderate', message: 'Accessibility statement does not declare a conformance level', wcag: [], regulatory: [...REG.EN_1211, ...REG.EAA_I3] },
  [F.STATEMENT_NO_ENFORCEMENT]: { ruleId: 'ariada/statement/enforcement-procedure-link', severity: 'moderate', message: 'Accessibility statement does not reference an enforcement procedure', wcag: [], regulatory: REG.EN_1211 },
  [F.STATEMENT_NO_FEEDBACK]: { ruleId: 'ariada/statement/feedback-mechanism-present', severity: 'serious', message: 'Accessibility statement has no feedback mechanism', wcag: [], regulatory: [...REG.EN_1211, ...REG.EAA_I3] },
  [F.STATEMENT_NO_LAST_REVISION]: { ruleId: 'ariada/statement/last-revision-date', severity: 'minor', message: 'Accessibility statement does not mention a last revision date', wcag: [], regulatory: REG.EN_1211 },
  [F.STATEMENT_NO_METHODOLOGY]: { ruleId: 'ariada/statement/methodology-disclosed', severity: 'minor', message: 'Accessibility statement does not disclose the testing methodology', wcag: [], regulatory: REG.EN_1211 },
  [F.STATEMENT_NO_NONCONFORMANCE]: { ruleId: 'ariada/statement/non-conformance-items-listed', severity: 'moderate', message: 'Statement claims partial or non-conformance but does not list specific items', wcag: [], regulatory: REG.EN_1211 },
  [F.FOOTER_NO_A11Y_LINK]: { ruleId: 'ariada/statement/page-link-from-footer', severity: 'serious', message: 'Page has no link to an accessibility statement', wcag: ['3.2.6'], regulatory: REG.WCAG_326 },
  [F.STATEMENT_NO_PUBDATE]: { ruleId: 'ariada/statement/publication-date-present', severity: 'moderate', message: 'Accessibility statement has no publication date in a <time datetime> element', wcag: [], regulatory: REG.EN_1211 },
  [F.NO_SKIP_LINK]: { ruleId: 'ariada/statement/skip-link-from-every-page', severity: 'moderate', message: 'Page has no skip navigation link', wcag: ['2.4.1'], regulatory: REG.WCAG_241 },
  [F.STATEMENT_NO_STANDARD]: { ruleId: 'ariada/statement/standard-reference', severity: 'minor', message: 'Accessibility statement does not explicitly reference WCAG or EN 301 549', wcag: [], regulatory: REG.EN_1211 },

  [F.BOOKING_NO_TIMEOUT_WARN]: { ruleId: 'ariada/transport/booking-timeout-has-warning', severity: 'serious', message: 'Booking hold timer has no timeout warning or description', wcag: ['2.2.1'], regulatory: REG.WCAG_221 },
  [F.FARE_TABLE_NO_CAPTION]: { ruleId: 'ariada/transport/fare-table-has-caption', severity: 'moderate', message: 'Fare table has no caption or caption is empty', wcag: ['1.3.1'], regulatory: REG.WCAG_131 },
  [F.LIVE_STATUS_NO_LIVE]: { ruleId: 'ariada/transport/live-status-has-live-region', severity: 'serious', message: 'Live departure board has no aria-live region', wcag: ['4.1.3'], regulatory: REG.WCAG_413 },
  [F.SEAT_NO_NAME]: { ruleId: 'ariada/transport/seat-selection-has-accessible-name', severity: 'serious', message: 'Seat selection control has no accessible name', wcag: ['4.1.2'], regulatory: REG.WCAG_412 },
  [F.TIMETABLE_NO_HEADERS]: { ruleId: 'ariada/transport/timetable-has-header-cells', severity: 'serious', message: 'Timetable table has no <th> header cells', wcag: ['1.3.1'], regulatory: REG.WCAG_131 },
};

// ---------------------------------------------------------------------------
// Interaction features declaration (contract field)
// ---------------------------------------------------------------------------

const INTERACTION_FEATURES: InteractionFeatureSpec[] = [
  { key: F.MISSING_ALT, description: 'Image missing alt text — joined on element scope', joinScope: 'element' },
  { key: F.CAPTIONS_NO_SRC, description: 'Captions track has no src', joinScope: 'document' },
  { key: F.MEDIA_NO_NAME, description: 'Media element has no accessible name', joinScope: 'document' },
  { key: F.TRACK_INVALID_KIND, description: 'Track has invalid kind or missing srclang', joinScope: 'document' },
  { key: F.VIDEO_NO_AUDIO_DESC, description: 'Video has no audio description track', joinScope: 'document' },
  { key: F.VIDEO_NO_CAPTIONS, description: 'Video has no captions track', joinScope: 'document' },
  { key: F.TWO_FA_NOT_KEYBOARD, description: '2FA inputs not keyboard accessible', joinScope: 'document' },
  { key: F.CURRENCY_NO_MACHINE, description: 'Currency value not machine-readable', joinScope: 'document' },
  { key: F.DATE_NO_FORMAT, description: 'Date input has no format hint', joinScope: 'document' },
  { key: F.IBAN_NO_FORMAT, description: 'IBAN input has no format example', joinScope: 'document' },
  { key: F.LANG_MISMATCH, description: 'Language declaration does not match content', joinScope: 'document' },
  { key: F.LOCALE_FALLBACK, description: 'Foreign text block has no lang attribute', joinScope: 'document' },
  { key: F.LOGIN_ERROR_NO_LIVE, description: 'Login error not announced to assistive technology', joinScope: 'document' },
  { key: F.NUMERIC_ERROR_LOCALE, description: 'Validation error not in page locale', joinScope: 'document' },
  { key: F.SESSION_TIMEOUT_NO_EXTEND, description: 'Session timeout dialog has no extend button', joinScope: 'document' },
  { key: F.AMOUNT_INPUT_NO_FORMAT, description: 'Amount input missing format indicator', joinScope: 'document' },
  { key: F.NO_AUTOCOMPLETE, description: 'Personal data field missing autocomplete', joinScope: 'document' },
  { key: F.QTY_VAGUE_LABEL, description: 'Quantity input has vague label', joinScope: 'document' },
  { key: F.CART_NO_LIVE, description: 'Cart summary has no live region', joinScope: 'document' },
  { key: F.COUPON_NO_FEEDBACK, description: 'Coupon input has no feedback mechanism', joinScope: 'document' },
  { key: F.ERROR_NO_ANNOUNCE, description: 'Error element not announced', joinScope: 'document' },
  { key: F.INPUT_NO_LABEL, description: 'Checkout form input has no label', joinScope: 'document' },
  { key: F.CONFIRM_NO_FOCUS, description: 'Order confirmation heading not focused', joinScope: 'document' },
  { key: F.PAYMENT_NO_FIELDSET, description: 'Payment radios not in fieldset', joinScope: 'document' },
  { key: F.REQUIRED_NOT_MACHINE, description: 'Required field not machine-readable', joinScope: 'document' },
  { key: F.STEP_NOT_FOCUSABLE, description: 'Checkout step not keyboard-focusable', joinScope: 'document' },
  { key: F.SUBMIT_VAGUE, description: 'Submit button has vague accessible name', joinScope: 'document' },
  { key: F.AUTOPLAY_NO_CONTROL, description: 'Autoplay media has no controls', joinScope: 'document' },
  { key: F.POSITIVE_TABINDEX, description: 'Positive tabindex in reading area', joinScope: 'document' },
  { key: F.READING_NO_LANG, description: 'Reading content has no lang', joinScope: 'document' },
  { key: F.TEXT_SPACING_IMPORTANT, description: 'Text spacing property uses !important', joinScope: 'document' },
  { key: F.VIEWPORT_BLOCKS_ZOOM, description: 'Viewport blocks user zoom', joinScope: 'document' },
  { key: F.STATEMENT_NO_CONFORMANCE, description: 'Statement missing conformance level', joinScope: 'document' },
  { key: F.STATEMENT_NO_ENFORCEMENT, description: 'Statement missing enforcement link', joinScope: 'document' },
  { key: F.STATEMENT_NO_FEEDBACK, description: 'Statement missing feedback mechanism', joinScope: 'document' },
  { key: F.STATEMENT_NO_LAST_REVISION, description: 'Statement missing last revision date', joinScope: 'document' },
  { key: F.STATEMENT_NO_METHODOLOGY, description: 'Statement missing methodology', joinScope: 'document' },
  { key: F.STATEMENT_NO_NONCONFORMANCE, description: 'Statement missing non-conformance list', joinScope: 'document' },
  { key: F.FOOTER_NO_A11Y_LINK, description: 'Page has no accessibility statement link', joinScope: 'document' },
  { key: F.STATEMENT_NO_PUBDATE, description: 'Statement missing publication date', joinScope: 'document' },
  { key: F.NO_SKIP_LINK, description: 'Page has no skip navigation link', joinScope: 'document' },
  { key: F.STATEMENT_NO_STANDARD, description: 'Statement missing standard reference', joinScope: 'document' },
  { key: F.BOOKING_NO_TIMEOUT_WARN, description: 'Booking timer has no timeout warning', joinScope: 'document' },
  { key: F.FARE_TABLE_NO_CAPTION, description: 'Fare table has no caption', joinScope: 'document' },
  { key: F.LIVE_STATUS_NO_LIVE, description: 'Live status has no live region', joinScope: 'document' },
  { key: F.SEAT_NO_NAME, description: 'Seat control has no accessible name', joinScope: 'document' },
  { key: F.TIMETABLE_NO_HEADERS, description: 'Timetable has no header cells', joinScope: 'document' },
];

// ---------------------------------------------------------------------------
// Domain-level regulatory refs summary
// ---------------------------------------------------------------------------

const ALL_REGULATORY_REFS: RegulatoryRef[] = [
  ...REG.WCAG_111, ...REG.WCAG_122, ...REG.WCAG_125, ...REG.WCAG_131, ...REG.WCAG_135,
  ...REG.WCAG_142, ...REG.WCAG_144, ...REG.WCAG_1412, ...REG.WCAG_211, ...REG.WCAG_221,
  ...REG.WCAG_241, ...REG.WCAG_243, ...REG.WCAG_246, ...REG.WCAG_311, ...REG.WCAG_312,
  ...REG.WCAG_326, ...REG.WCAG_331, ...REG.WCAG_332, ...REG.WCAG_412, ...REG.WCAG_413,
  ...REG.EN_1211, ...REG.EAA_I3,
];

// ---------------------------------------------------------------------------
// Public exports (backwards-compatible with existing callers)
// ---------------------------------------------------------------------------

/** Feature key set when an image element has no alternative text. */
export const A11Y_MISSING_ALT = F.MISSING_ALT;

/** Rule id emitted for an image missing alternative text. */
export const IMAGE_ALT_RULE_ID = 'image-alt';

/**
 * Document feature key under which the full rule-library findings carried on the
 * snapshot are stashed during the shared pass, so the deterministic `evaluate`
 * can read them back without touching the snapshot directly.
 */
const AXE_FINDINGS_FEATURE = 'a11y:axe-findings';

/** Strip the leading `::` document-scope marker from a stored feature key. */
function documentFeatureKey(compositeKey: string): string {
  return compositeKey.startsWith('::') ? compositeKey.slice(2) : compositeKey;
}

/**
 * Pull the full rule-library findings stashed on a document feature during the
 * shared pass. Returns undefined when capture did not run the library.
 */
function readAxeFindings(features: ExtractedFeatures): readonly Finding[] | undefined {
  for (const [compositeKey, value] of features.byDocument) {
    if (!value) continue;
    if (documentFeatureKey(compositeKey) === AXE_FINDINGS_FEATURE) {
      return value as readonly Finding[];
    }
  }
  return undefined;
}

/**
 * The image-alt fallback derived from the element outline. Suppressed when the
 * rule library already covers image-alt against the live elements, so the same
 * image is not reported twice under two different selector syntaxes.
 */
function imageAltFallbackFindings(features: ExtractedFeatures): Finding[] {
  const findings: Finding[] = [];
  for (const [selector, data] of features.byElement) {
    const a11y = data.domainFeatures['accessibility'];
    if (!a11y?.get(F.MISSING_ALT)) continue;
    findings.push({
      id: `${IMAGE_ALT_RULE_ID}-${selector}`,
      scanId: '',
      domain: 'accessibility',
      ruleId: IMAGE_ALT_RULE_ID,
      severity: 'serious',
      element: { selector },
      message: 'Image is missing alternative text',
      wcagMapping: ['1.1.1'],
      regulatoryMapping: [...REG.WCAG_111],
    });
  }
  return findings;
}

/** The jurisdiction-scoped EAA document rules, kept regardless of the library run. */
function eaaDocumentFindings(features: ExtractedFeatures): Finding[] {
  const findings: Finding[] = [];
  for (const [compositeKey, value] of features.byDocument) {
    if (!value) continue;
    const featureKey = documentFeatureKey(compositeKey);
    if (featureKey === AXE_FINDINGS_FEATURE) continue;
    const spec = DOC_RULE_SPECS[featureKey];
    if (!spec) continue;
    findings.push({
      id: `${spec.ruleId}::document`,
      scanId: '',
      domain: 'accessibility',
      ruleId: spec.ruleId,
      severity: spec.severity,
      element: { selector: 'html' },
      message: spec.message,
      wcagMapping: spec.wcag,
      regulatoryMapping: [...spec.regulatory],
    });
  }
  return findings;
}

/**
 * Append the library findings, deduplicated by rule id and selector against what
 * is already collected so a library run reporting the same problem twice (or a
 * problem the snapshot rules also caught) collapses to one entry.
 */
function appendDeduplicated(into: Finding[], axeFindings: readonly Finding[]): void {
  const seen = new Set<string>(into.map((f) => `${f.ruleId} ${f.element.selector}`));
  for (const f of axeFindings) {
    const key = `${f.ruleId} ${f.element.selector}`;
    if (seen.has(key)) continue;
    seen.add(key);
    into.push({ ...f, domain: 'accessibility' });
  }
}

// ---------------------------------------------------------------------------
// DomainModule implementation
// ---------------------------------------------------------------------------

export const accessibilityDomain: DomainModule = {
  id: 'accessibility',
  title: 'Accessibility',
  version: '0.2.0',

  interactionFeatures: INTERACTION_FEATURES,
  regulatory: ALL_REGULATORY_REFS,

  extractors: {
    /** Per-element: image-alt uses element attribute data from domOutline. */
    perElement(el: ElementHandle, acc: FeatureSink): void {
      if (el.nodeName.toLowerCase() === 'img' && !hasAltText(el)) {
        acc.set(el.selector, F.MISSING_ALT, true);
      }
    },

    /**
     * Per-document: all 46 EAA rules detected via HTML string analysis.
     * Runs once per document after the element traversal completes.
     * HTML comments are stripped first so comment block examples in fixture
     * files cannot fool the string-pattern detectors.
     */
    perDocument(snap: PropertySnapshot, acc: FeatureSink): void {
      const stripped = stripHtmlComments(snap.html);
      extractAudiovisual(stripped, acc);
      extractBanking(stripped, acc);
      extractCheckout(stripped, acc);
      extractEbooks(stripped, acc);
      extractStatement(stripped, acc);
      extractTransport(stripped, acc);

      // Carry the full rule-library findings (computed against the live page at
      // capture time) onto a document feature, so the deterministic evaluate can
      // merge them with the snapshot rules. No I/O here — the work already ran.
      if (snap.axeFindings && snap.axeFindings.length > 0) {
        acc.set('', AXE_FINDINGS_FEATURE, snap.axeFindings);
      }
    },
  },

  /**
   * Deterministic rule engine. Given the same features it always returns the
   * same findings. No I/O, no external state.
   */
  evaluate(features: ExtractedFeatures): Finding[] {
    // The library covers the broad WCAG surface and anchors each finding to a
    // live element; where a snapshot fallback rule and a library rule describe
    // the same check, the library wins (read first, then dedup-appended).
    const axeFindings = readAxeFindings(features);
    const libraryRuleIds = new Set<string>((axeFindings ?? []).map((f) => f.ruleId));

    const findings: Finding[] = [];

    // image-alt fallback - suppressed when the library already covers image-alt.
    if (!libraryRuleIds.has(IMAGE_ALT_RULE_ID)) {
      findings.push(...imageAltFallbackFindings(features));
    }

    findings.push(...eaaDocumentFindings(features));

    if (axeFindings && axeFindings.length > 0) {
      appendDeduplicated(findings, axeFindings);
    }

    return findings;
  },
};

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

function hasAltText(el: ElementHandle): boolean {
  const attributes = el.attributes;
  if (!attributes) return false;
  for (const [name, value] of Object.entries(attributes)) {
    if (name.toLowerCase() === 'alt') return value.trim().length > 0;
  }
  return false;
}
