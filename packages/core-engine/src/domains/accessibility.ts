// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Accessibility domain — wraps the axe baseline (image-alt) and all EAA-scoped
// rules from the wcag-rules-extended packs. Because the EAA rule implementations
// depend on live DOM APIs (querySelectorAll, closest, ownerDocument) they cannot
// be imported and run in pure synchronous extractors. Instead, detection is
// re-implemented here using regex over the captured PropertySnapshot.html string,
// which is the same raw HTML the browser rendered.
//
// Detection is split as required by the DomainModule contract:
//   perElement — element-attribute checks that use the domOutline (image-alt)
//   perDocument — HTML-string regex checks for all EAA rules
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

// ---------------------------------------------------------------------------
// Utility: set a document-level feature flag
// ---------------------------------------------------------------------------

function setDocFlag(acc: FeatureSink, key: string): void {
  acc.set('', key, true);
}

// ---------------------------------------------------------------------------
// Helper: strip HTML comments so fixture comment blocks cannot fool detectors
// ---------------------------------------------------------------------------

function stripHtmlComments(html: string): string {
  return html.replace(/<!--[\s\S]*?-->/g, '');
}

// ---------------------------------------------------------------------------
// Helper: detect Nordic-language page
// ---------------------------------------------------------------------------

function isNordicPage(html: string): boolean {
  const langMatch = html.match(/<html[^>]*\slang=["']([^"']+)["']/i);
  if (!langMatch) return false;
  const lang = (langMatch[1] ?? '').toLowerCase().split('-')[0] ?? '';
  return lang === 'sv' || lang === 'da' || lang === 'fi' || lang === 'nb' || lang === 'no' || lang === 'nn';
}

// ---------------------------------------------------------------------------
// Helper: detect accessibility statement page
// ---------------------------------------------------------------------------

function isStatementPage(html: string): boolean {
  if (/(<h1[^>]*>)[^<]*(accessibility.{0,30}statement|tillg.{0,30}nglighetsredogörelse|saavutettavuusseloste)/i.test(html)) {
    return true;
  }
  if (/<title[^>]*>[^<]*(accessibility[^<]*statement|a11y[^<]*statement)/i.test(html)) {
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
  const trackRe = /<track\b([^>]*)>/gi;
  for (const m of html.matchAll(trackRe)) {
    const attrs = m[1] ?? '';
    const kindMatch = attrs.match(/\bkind=["']?([^"'\s>]+)["']?/i);
    const kind = kindMatch?.[1]?.toLowerCase() ?? '';
    if (kind === 'captions' || kind === 'subtitles') {
      const srcMatch = attrs.match(/\bsrc=["']([^"']*)["']/i);
      if (!srcMatch || (srcMatch[1] ?? '').trim() === '') {
        setDocFlag(acc, F.CAPTIONS_NO_SRC);
        break;
      }
    }
  }

  // ariada/audiovisual/media-element-has-accessible-name
  for (const m of html.matchAll(/<(video|audio)\b([^>]*)>/gi)) {
    const attrs = m[2] ?? '';
    if (!/\bcontrols\b/i.test(attrs)) continue;
    const hasName =
      /\baria-label=["'][^"']+["']/i.test(attrs) ||
      /\btitle=["'][^"']+["']/i.test(attrs) ||
      /\baria-labelledby=["'][^"']+["']/i.test(attrs);
    if (!hasName) {
      setDocFlag(acc, F.MEDIA_NO_NAME);
      break;
    }
  }

  // ariada/audiovisual/track-has-valid-kind
  const VALID_KINDS = new Set(['captions', 'subtitles', 'descriptions', 'chapters', 'metadata']);
  for (const m of html.matchAll(/<track\b([^>]*)>/gi)) {
    const attrs = m[1] ?? '';
    const kindMatch = attrs.match(/\bkind=["']?([^"'\s>]+)["']?/i);
    const kind = kindMatch?.[1]?.toLowerCase() ?? 'subtitles';
    if (!VALID_KINDS.has(kind)) {
      setDocFlag(acc, F.TRACK_INVALID_KIND);
      break;
    }
    if (kind === 'subtitles' && !/\bsrclang=["'][^"']+["']/i.test(attrs)) {
      setDocFlag(acc, F.TRACK_INVALID_KIND);
      break;
    }
  }

  // ariada/audiovisual/video-has-audio-description-track
  for (const m of html.matchAll(/<video\b([^>]*)>([\s\S]*?)<\/video>/gi)) {
    const vAttrs = m[1] ?? '';
    const vBody = m[2] ?? '';
    if (!/\bcontrols\b/i.test(vAttrs)) continue;
    const hasDescTrack = /<track\b[^>]*\bkind=["']?descriptions["']?/i.test(vBody);
    const hasAriaDesc = /\baria-describedby=["'][^"']+["']/i.test(vAttrs);
    if (!hasDescTrack && !hasAriaDesc) {
      setDocFlag(acc, F.VIDEO_NO_AUDIO_DESC);
      break;
    }
  }

  // ariada/audiovisual/video-has-captions-track
  for (const m of html.matchAll(/<video\b([^>]*)>([\s\S]*?)<\/video>/gi)) {
    const vAttrs = m[1] ?? '';
    const vBody = m[2] ?? '';
    if (/\bmuted\b/i.test(vAttrs) && /\bautoplay\b/i.test(vAttrs)) continue;
    if (!/\bcontrols\b/i.test(vAttrs)) continue;
    const hasCaptionTrack = /<track\b[^>]*\bkind=["']?(captions|subtitles)["']?/i.test(vBody);
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
  const blockingOtpRe1 = /<input[^>]+maxlength=["']1["'][^>]*(?:inputmode=["']none["']|tabindex=["']-1["']|\breadonly\b)[^>]*>/gi;
  const blockingOtpRe2 = /<input[^>]+(?:inputmode=["']none["']|tabindex=["']-1["']|\breadonly\b)[^>]*maxlength=["']1["'][^>]*>/gi;
  const b1 = html.match(blockingOtpRe1);
  const b2 = html.match(blockingOtpRe2);
  if ((b1 && b1.length >= 3) || (b2 && b2.length >= 3)) {
    setDocFlag(acc, F.TWO_FA_NOT_KEYBOARD);
  }

  // ariada/banking/currency-format-readable
  // Scan inline elements (span, a, abbr) directly — they may be nested inside <p>
  // so we cannot rely on outer-element matching which catches <p> first.
  const currencyTextRe = /\d[\d\s,.]*(kr|SEK|EUR|GBP|USD|€|\$|£)/i;
  const currencyClassRe = /class=["'][^"']*\b(balance|amount|price|cost|total)\b[^"']*["']/i;
  // First scan block-level elements (div/p/section) — catches elements with direct class
  for (const m of html.matchAll(/<(div|section|td)\b([^>]*)>([\s\S]*?)<\/\1>/gi)) {
    const attrs = m[2] ?? '';
    const body = m[3] ?? '';
    if (!currencyClassRe.test(attrs)) continue;
    if (!currencyTextRe.test(body)) continue;
    const hasDataValue = /<data\b[^>]*\bvalue=/i.test(body) || /<output\b/i.test(body);
    const hasAriaLabel = /\baria-label=["'][^"']+["']/i.test(attrs);
    if (!hasDataValue && !hasAriaLabel) {
      setDocFlag(acc, F.CURRENCY_NO_MACHINE);
      break;
    }
  }
  // Also scan inline elements (span) directly — they may not match above if nested in <p>
  if (!html.includes(F.CURRENCY_NO_MACHINE)) {
    for (const m of html.matchAll(/<span\b([^>]*)>([^<]*)<\/span>/gi)) {
      const attrs = m[1] ?? '';
      const body = m[2] ?? '';
      if (!currencyClassRe.test(attrs)) continue;
      if (!currencyTextRe.test(body)) continue;
      const hasAriaLabel = /\baria-label=["'][^"']+["']/i.test(attrs);
      if (!hasAriaLabel) {
        setDocFlag(acc, F.CURRENCY_NO_MACHINE);
        break;
      }
    }
  }

  // ariada/banking/date-format-locale
  const dateName = /\bname=["'][^"']*(date|datum|dag|dato|päivä)[^"']*["']/i;
  for (const m of html.matchAll(/<input\b([^>]*)>/gi)) {
    const attrs = m[1] ?? '';
    if (!dateName.test(attrs)) continue;
    const placeholder = attrs.match(/\bplaceholder=["']([^"']*)["']/i)?.[1] ?? '';
    const hasFormatHint = /\d{4}|mm|dd|yyyy|yy|åå/i.test(placeholder);
    const hasAriaDesc = /\baria-describedby=["'][^"']+["']/i.test(attrs);
    if (!hasFormatHint && !hasAriaDesc) {
      setDocFlag(acc, F.DATE_NO_FORMAT);
      break;
    }
  }

  // ariada/banking/iban-input-format
  const ibanNameRe = /\b(?:name|id|aria-label)=["'][^"']*\biban\b[^"']*["']/i;
  for (const m of html.matchAll(/<input\b([^>]*)>/gi)) {
    const attrs = m[1] ?? '';
    if (!ibanNameRe.test(attrs)) continue;
    const placeholder = attrs.match(/\bplaceholder=["']([^"']*)["']/i)?.[1] ?? '';
    const hasIbanExample = /[A-Z]{2}\d{2}\s*[A-Z0-9\s]{4,}/i.test(placeholder);
    const hasAriaDesc = /\baria-describedby=["'][^"']+["']/i.test(attrs);
    if (!hasIbanExample && !hasAriaDesc) {
      setDocFlag(acc, F.IBAN_NO_FORMAT);
      break;
    }
  }

  // ariada/banking/lang-matches-locale
  const langMatch = html.match(/<html[^>]*\slang=["']([^"']+)["']/i);
  const pageLang = (langMatch?.[1] ?? '').toLowerCase().split('-')[0] ?? '';
  const nordicCharRe = /[åäöøæÅÄÖØÆ]/;
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  const bodyText = bodyMatch?.[1] ?? html;
  if (pageLang === 'en' && nordicCharRe.test(bodyText)) {
    setDocFlag(acc, F.LANG_MISMATCH);
  }

  // ariada/banking/locale-fallback
  if (isNordicPage(html)) {
    const pRe = /<p\b([^>]*)>([\s\S]*?)<\/p>/gi;
    for (const m of html.matchAll(pRe)) {
      const pAttrs = m[1] ?? '';
      const pText = (m[2] ?? '').replace(/<[^>]*>/g, '').trim();
      if (pText.length < 80 || /\blang=/i.test(pAttrs)) continue;
      if (nordicCharRe.test(pText)) continue;
      const asciiRatio = pText.replace(/[^\x20-\x7E]/g, '').length / pText.length;
      if (asciiRatio > 0.85) {
        setDocFlag(acc, F.LOCALE_FALLBACK);
        break;
      }
    }
  }

  // ariada/banking/login-error-not-blocking
  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ?? '';
  const isLoginPage = /log.{0,3}in|sign.{0,3}in|logga.{0,3}in/i.test(titleMatch) || html.includes('type="password"');
  if (isLoginPage) {
    for (const m of html.matchAll(/<div\b([^>]*)>([\s\S]*?)<\/div>/gi)) {
      const attrs = m[1] ?? '';
      const content = (m[2] ?? '').replace(/<[^>]*>/g, '').trim();
      if (content.length === 0) continue;
      if (!/class=["'][^"']*\berror\b/i.test(attrs) && !/\brole=["']alert["']/i.test(attrs)) continue;
      const hasLive = /\baria-live=["'][^"']+["']/i.test(attrs) || /\brole=["']alert["']/i.test(attrs);
      if (!hasLive) {
        setDocFlag(acc, F.LOGIN_ERROR_NO_LIVE);
        break;
      }
    }
  }

  // ariada/banking/numeric-validation-error-locale
  if (isNordicPage(html)) {
    for (const m of html.matchAll(/<(?:div|span|p)\b([^>]*)>([\s\S]*?)<\/(?:div|span|p)>/gi)) {
      const attrs = m[1] ?? '';
      const content = (m[2] ?? '').replace(/<[^>]*>/g, '').trim();
      if (content.length < 10) continue;
      if (!/class=["'][^"']*\berror\b[^"']*["']|role=["']alert["']/i.test(attrs)) continue;
      if (!nordicCharRe.test(content)) {
        setDocFlag(acc, F.NUMERIC_ERROR_LOCALE);
        break;
      }
    }
  }

  // ariada/banking/session-timeout-warning
  for (const m of html.matchAll(/<(?:div|section|aside)\b([^>]*)role=["']alertdialog["']([^>]*)>([\s\S]*?)<\/(?:div|section|aside)>/gi)) {
    const attrs = (m[1] ?? '') + (m[2] ?? '');
    const body = m[3] ?? '';
    if (!/class=["'][^"']*(session|timeout|inactivity)[^"']*["']/i.test(attrs)) continue;
    const hasExtendBtn = /<button\b[^>]*>[^<]*(extend|continue|resume|stay|keep)/i.test(body);
    if (!hasExtendBtn) {
      setDocFlag(acc, F.SESSION_TIMEOUT_NO_EXTEND);
      break;
    }
  }

  // ariada/banking/transaction-amount-input
  const amountNameRe = /\bname=["'][^"']*(amount|belopp|belop|sum|betalning)[^"']*["']/i;
  for (const m of html.matchAll(/<input\b([^>]*)>/gi)) {
    const attrs = m[1] ?? '';
    if (!amountNameRe.test(attrs)) continue;
    const hasInputmode = /\binputmode=["'](decimal|numeric)["']/i.test(attrs);
    const ariaLabel = attrs.match(/\baria-label=["']([^"']*)["']/i)?.[1] ?? '';
    const hasCurrencyInName = /(SEK|EUR|GBP|USD|kr|euro|kronor)/i.test(ariaLabel);
    if (!hasCurrencyInName) {
      setDocFlag(acc, F.AMOUNT_INPUT_NO_FORMAT);
      break;
    }
    void hasInputmode; // covered above; currency check is the deciding axis
  }
}

// eslint-disable-next-line sonarjs/cognitive-complexity -- EAA checkout rule pack mirrors the regulatory rule list; refactor deferred
function extractCheckout(html: string, acc: FeatureSink): void {
  const isCheckoutForm = (attrs: string): boolean =>
    /class=["'][^"']*\b(checkout|cart|payment|order|shipping)\b/i.test(attrs) ||
    /id=["'][^"']*(checkout|cart|payment|order|shipping)/i.test(attrs);

  // ariada/checkout/autocomplete-personal-data
  const personalNameRe = /\bname=["'][^"']*(email|phone|tel|firstname|lastname|first.name|last.name|address|zip|postal|city)[^"']*["']/i;
  for (const m of html.matchAll(/<input\b([^>]*)>/gi)) {
    const attrs = m[1] ?? '';
    if (!personalNameRe.test(attrs)) continue;
    const autocomplete = attrs.match(/\bautocomplete=["']([^"']*)["']/i)?.[1] ?? '';
    if (!autocomplete || autocomplete === 'off') {
      setDocFlag(acc, F.NO_AUTOCOMPLETE);
      break;
    }
  }

  // ariada/checkout/cart-quantity-input-label
  const qtyNameRe = /\bname=["'][^"']*(qty|quantity|antal|menge)[^"']*["']/i;
  for (const m of html.matchAll(/<input\b([^>]*)>/gi)) {
    const attrs = m[1] ?? '';
    if (!qtyNameRe.test(attrs)) continue;
    const ariaLabel = attrs.match(/\baria-label=["']([^"']*)["']/i)?.[1] ?? '';
    if (ariaLabel && ariaLabel.trim().split(/\s+/).length <= 1) {
      setDocFlag(acc, F.QTY_VAGUE_LABEL);
      break;
    }
    if (!ariaLabel && !/\baria-labelledby=["'][^"']+["']/i.test(attrs)) {
      const inputId = attrs.match(/\bid=["']([^"']+)["']/i)?.[1];
      if (inputId) {
        const labelRe = new RegExp(`<label[^>]*\\bfor=["']${inputId}["'][^>]*>([^<]+)<\\/label>`, 'i');
        const labelMatch = html.match(labelRe);
        const labelText = labelMatch?.[1]?.trim() ?? '';
        if (labelText && labelText.split(/\s+/).length <= 1) {
          setDocFlag(acc, F.QTY_VAGUE_LABEL);
          break;
        }
      }
    }
  }

  // ariada/checkout/cart-update-live-region
  const cartClassRe = /class=["'][^"']*\b(cart-summary|cart.{0,10}total|order.{0,10}summary)\b[^"']*["']/i;
  for (const m of html.matchAll(/<(div|section|aside)\b([^>]*)>([\s\S]*?)<\/\1>/gi)) {
    const attrs = m[2] ?? '';
    if (!cartClassRe.test(attrs)) continue;
    const hasLive =
      /\baria-live=["'][^"']+["']/i.test(attrs) ||
      /\brole=["'](status|region|alert)["']/i.test(attrs);
    if (!hasLive) {
      setDocFlag(acc, F.CART_NO_LIVE);
      break;
    }
  }

  // ariada/checkout/discount-code-feedback
  const couponNameRe = /\bname=["'][^"']*(promo|coupon|discount|code|voucher)[^"']*["']/i;
  for (const m of html.matchAll(/<input\b([^>]*)>/gi)) {
    const attrs = m[1] ?? '';
    if (!couponNameRe.test(attrs)) continue;
    if (!/\baria-describedby=["'][^"']+["']/i.test(attrs)) {
      setDocFlag(acc, F.COUPON_NO_FEEDBACK);
      break;
    }
  }

  // ariada/checkout/error-identification
  for (const m of html.matchAll(/<(div|span|p)\b([^>]*)>([\s\S]*?)<\/\1>/gi)) {
    const attrs = m[2] ?? '';
    const content = (m[3] ?? '').replace(/<[^>]*>/g, '').trim();
    if (!/class=["'][^"']*\berror\b[^"']*["']/i.test(attrs) || content.length === 0) continue;
    const hasAnnounce = /\baria-live=["'][^"']+["']/i.test(attrs) || /\brole=["']alert["']/i.test(attrs);
    if (!hasAnnounce) {
      setDocFlag(acc, F.ERROR_NO_ANNOUNCE);
      break;
    }
  }

  // ariada/checkout/form-label-association
  for (const formMatch of html.matchAll(/<form\b([^>]*)>([\s\S]*?)<\/form>/gi)) {
    const formAttrs = formMatch[1] ?? '';
    const formBody = formMatch[2] ?? '';
    if (!isCheckoutForm(formAttrs)) continue;
    for (const inputMatch of formBody.matchAll(/<input\b([^>]*)>/gi)) {
      const attrs = inputMatch[1] ?? '';
      const inputType = attrs.match(/\btype=["']([^"']*)["']/i)?.[1]?.toLowerCase() ?? 'text';
      if (/^(hidden|submit|button|reset|image)$/.test(inputType)) continue;
      const hasAriaLabel = /\baria-label=["'][^"']+["']/i.test(attrs);
      const hasAriaLabelledby = /\baria-labelledby=["'][^"']+["']/i.test(attrs);
      const inputId = attrs.match(/\bid=["']([^"']+)["']/i)?.[1];
      const hasLabel = inputId
        ? new RegExp(`<label[^>]*\\bfor=["']${inputId}["']`, 'i').test(html)
        : false;
      if (!hasAriaLabel && !hasAriaLabelledby && !hasLabel) {
        setDocFlag(acc, F.INPUT_NO_LABEL);
        break;
      }
    }
  }

  // ariada/checkout/order-confirmation-focus
  const confirmMatch = html.match(/<h[12]\b([^>]*)>([^<]*(?:thank you|order confirmed|order placed)[^<]*)<\/h[12]>/i);
  if (confirmMatch) {
    const attrs = confirmMatch[1] ?? '';
    const hasFocus = /\bautofocus\b/i.test(attrs) || /\btabindex=["']?-?\d+["']?/i.test(attrs);
    if (!hasFocus) {
      setDocFlag(acc, F.CONFIRM_NO_FOCUS);
    }
  }

  // ariada/checkout/payment-fieldset-grouping
  // Collect all payment-radio name groups; each group of ≥2 must be inside a fieldset.
  // Global hasFieldset is wrong when BOTH passing and failing groups exist — check per name-group.
  {
    const radioGroupNames = new Map<string, number>();
    for (const m of html.matchAll(/<input\b([^>]*)>/gi)) {
      const attrs = m[1] ?? '';
      if (!/\btype=["']radio["']/i.test(attrs)) continue;
      const nameMatch = attrs.match(/\bname=["']([^"']*)["']/i);
      const name = (nameMatch?.[1] ?? '').toLowerCase();
      if (!name.includes('payment') && !name.includes('pay-') && !name.includes('pay_')) continue;
      radioGroupNames.set(name, (radioGroupNames.get(name) ?? 0) + 1);
    }
    for (const [groupName, count] of radioGroupNames) {
      if (count < 2) continue;
      // Check if at least one radio of this name is inside a <fieldset>
      const escapedName = groupName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const inFieldset = new RegExp(
        `<fieldset\\b[^>]*>[\\s\\S]*?<input\\b[^>]*\\bname=["']${escapedName}["'][^>]*>`,
        'i'
      ).test(html);
      if (!inFieldset) {
        setDocFlag(acc, F.PAYMENT_NO_FIELDSET);
        break;
      }
    }
  }

  // ariada/checkout/required-field-machine-readable
  for (const m of html.matchAll(/<label\b([^>]*)>([\s\S]*?)<\/label>/gi)) {
    const labelAttrs = m[1] ?? '';
    const labelText = (m[2] ?? '').replace(/<[^>]*>/g, '').trim();
    if (!/\*|required\b/i.test(labelText)) continue;
    const forAttr = labelAttrs.match(/\bfor=["']([^"']+)["']/i)?.[1];
    if (!forAttr) continue;
    const inputRe = new RegExp(`<input\\b[^>]*\\bid=["']${forAttr}["'][^>]*>`, 'i');
    const inputMatch = html.match(inputRe);
    if (!inputMatch) continue;
    const inputAttrs = inputMatch[0];
    const hasMachineRequired = /\brequired\b/i.test(inputAttrs) || /\baria-required=["']true["']/i.test(inputAttrs);
    if (!hasMachineRequired) {
      setDocFlag(acc, F.REQUIRED_NOT_MACHINE);
      break;
    }
  }

  // ariada/checkout/step-keyboard-accessible
  // Scan for step-like opening tags directly (attribute-only regex, not balanced-tag matching)
  // because <div class="checkout-step"> may be nested inside <li>, causing the <li> match
  // to consume the inner <div> before it is independently seen.
  for (const m of html.matchAll(/<(\w+)\b([^>]*)>/gi)) {
    const tag = (m[1] ?? '').toLowerCase();
    const attrs = m[2] ?? '';
    const looksLikeStep =
      /class=["'][^"']*(checkout-step|checkout_step|wizard-step|stepper-step)[^"']*["']/i.test(attrs) ||
      /data-role=["'][^"']*(step|wizard)[^"']*["']/i.test(attrs);
    if (!looksLikeStep) continue;
    const isClickable = /\bonclick\b/i.test(attrs) || /\brole=["']button["']/i.test(attrs);
    if (!isClickable) continue;
    const nativeInteractive = tag === 'a' || tag === 'button' || tag === 'input' || tag === 'select';
    const hasTabindex = /\btabindex=["']?\d["']?/i.test(attrs);
    if (!nativeInteractive && !hasTabindex) {
      setDocFlag(acc, F.STEP_NOT_FOCUSABLE);
      break;
    }
  }

  // ariada/checkout/submit-button-accessible-name
  const VAGUE_LABELS = new Set(['submit', 'continue', 'next', 'go', 'ok', 'send']);
  for (const formMatch of html.matchAll(/<form\b([^>]*)>([\s\S]*?)<\/form>/gi)) {
    const formAttrs = formMatch[1] ?? '';
    const formBody = formMatch[2] ?? '';
    if (!isCheckoutForm(formAttrs)) continue;
    for (const btnMatch of formBody.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/gi)) {
      const btnText = (btnMatch[2] ?? '').replace(/<[^>]*>/g, '').trim().toLowerCase();
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
  for (const m of html.matchAll(/<(audio|video)\b([^>]*)>/gi)) {
    const attrs = m[2] ?? '';
    if (!/\bautoplay\b/i.test(attrs)) continue;
    if (!/\bmuted\b/i.test(attrs) && !/\bcontrols\b/i.test(attrs)) {
      setDocFlag(acc, F.AUTOPLAY_NO_CONTROL);
      break;
    }
  }

  // ariada/ebooks/no-positive-tabindex-in-reading
  for (const m of html.matchAll(/<article\b[^>]*>([\s\S]*?)<\/article>/gi)) {
    if (/\btabindex=["']?[1-9]\d*["']?/i.test(m[1] ?? '')) {
      setDocFlag(acc, F.POSITIVE_TABINDEX);
      break;
    }
  }
  if (!html.match(/a11y:positive-tabindex/)) { // only if not already set via article
    for (const m of html.matchAll(/data-reading-content[^>]*>([\s\S]*?)(?=<\/)/gi)) {
      if (/\btabindex=["']?[1-9]\d*["']?/i.test(m[1] ?? '')) {
        setDocFlag(acc, F.POSITIVE_TABINDEX);
        break;
      }
    }
  }

  // ariada/ebooks/reading-content-has-lang
  for (const m of html.matchAll(/<(article|div)\b([^>]*)>/gi)) {
    const tag = (m[1] ?? '').toLowerCase();
    const attrs = m[2] ?? '';
    const isReadingArea = tag === 'article' || /\brole=["']document["']/i.test(attrs);
    if (!isReadingArea) continue;
    const langAttr = attrs.match(/\blang=["']([^"']*)["']/i)?.[1] ?? null;
    const hasValidLang = langAttr !== null && langAttr.trim().length > 0;
    if (!hasValidLang) {
      setDocFlag(acc, F.READING_NO_LANG);
      break;
    }
  }

  // ariada/ebooks/text-spacing-overridable
  const textSpacingProps = ['line-height', 'letter-spacing', 'word-spacing', 'text-indent'];
  for (const m of html.matchAll(/\bstyle=["']([^"']*)["']/gi)) {
    const styleVal = m[1] ?? '';
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
  for (const m of html.matchAll(/<meta\b[^>]*>/gi)) {
    const tag = m[0];
    const isViewport =
      /\bname=["']viewport["']/i.test(tag) ||
      /\bcontent=["'][^"']*(?:width=device-width|initial-scale)[^"']*["'][^>]*\bname=["']viewport["']/i.test(tag);
    if (!isViewport) continue;
    const contentMatch =
      tag.match(/\bcontent=["']([^"']*)["']/i);
    const viewportContent = contentMatch?.[1] ?? '';
    if (!viewportContent) continue;
    if (/user-scalable\s*=\s*no/i.test(viewportContent)) {
      setDocFlag(acc, F.VIEWPORT_BLOCKS_ZOOM);
      break;
    }
    const maxScaleMatch = viewportContent.match(/maximum-scale\s*=\s*([\d.]+)/i);
    if (maxScaleMatch && parseFloat(maxScaleMatch?.[1] ?? '5') < 2.0) {
      setDocFlag(acc, F.VIEWPORT_BLOCKS_ZOOM);
      break;
    }
  }
}

function extractStatement(html: string, acc: FeatureSink): void {
  // These rules apply to ALL pages — but only when the page has navigable structure.
  // A page with no <nav>, <main>, or <header> is a fragment/component and should not fire.
  const hasNavigableStructure =
    /<(nav|main|header|footer)\b/i.test(html) ||
    /\brole=["'](navigation|main|banner|contentinfo)["']/i.test(html);

  if (hasNavigableStructure) {
    // ariada/statement/page-link-from-footer — applies to ALL pages with navigation
    const a11yLinkRe = /<a\b[^>]*\bhref=["'][^"']*(accessibility|a11y|tillg.{1,10}nglighet|saavutettav)[^"']*["']/i;
    if (!a11yLinkRe.test(html)) {
      setDocFlag(acc, F.FOOTER_NO_A11Y_LINK);
    }

    // ariada/statement/skip-link-from-every-page — applies to ALL pages with navigation
    const skipLinkRe = /<a\b[^>]*\bhref=["']#[^"']+["'][^>]*>([^<]*(?:skip|hoppa|skippe|ohita|passer|hyppää)[^<]*)<\/a>/i;
    if (!skipLinkRe.test(html)) {
      setDocFlag(acc, F.NO_SKIP_LINK);
    }
  }

  // All remaining statement rules apply only on statement pages
  if (!isStatementPage(html)) return;

  // ariada/statement/conformance-level-declared
  if (!/WCAG\s+2\.[012]\s+Level\s+[AB]{1,2}|fully\s+conformant|partially\s+conformant|non.conformant/i.test(html)) {
    setDocFlag(acc, F.STATEMENT_NO_CONFORMANCE);
  }

  // ariada/statement/enforcement-procedure-link
  const hasEnforcement =
    /href=["'][^"']*(do\.se|digg\.se|gov\.uk\/guidance|just\.fvst|msb\.se|myndigheten)[^"']*["']/i.test(html) ||
    /enforcement\s+procedure|national\s+authority|tillsynsmyndighet|klagomålshantering/i.test(html);
  if (!hasEnforcement) {
    setDocFlag(acc, F.STATEMENT_NO_ENFORCEMENT);
  }

  // ariada/statement/feedback-mechanism-present
  const hasFeedback = /href=["'](?:mailto:|tel:)[^"']+["']|href=["'][^"']*(contact|kontakt|feedback|report|palaute)[^"']*["']/i.test(html);
  if (!hasFeedback) {
    setDocFlag(acc, F.STATEMENT_NO_FEEDBACK);
  }

  // ariada/statement/last-revision-date
  if (!/last\s+(?:updated|reviewed|revised)|senast\s+(?:uppdaterad|reviderad)|päivitetty/i.test(html)) {
    setDocFlag(acc, F.STATEMENT_NO_LAST_REVISION);
  }

  // ariada/statement/methodology-disclosed
  if (!/self.assessment|external\s+audit|user\s+testing|testing\s+methodology|testmetod|självskattning|assessment\s+approach/i.test(html)) {
    setDocFlag(acc, F.STATEMENT_NO_METHODOLOGY);
  }

  // ariada/statement/non-conformance-items-listed
  if (/partially\s+conformant|non.conformant/i.test(html)) {
    const hasListOfItems = /(<ul\b|<ol\b)/i.test(html) && /<li\b[^>]*>[\s\S]{10,}/i.test(html);
    if (!hasListOfItems) {
      setDocFlag(acc, F.STATEMENT_NO_NONCONFORMANCE);
    }
  }

  // ariada/statement/publication-date-present
  if (!/<time\b[^>]*\bdatetime=["'][^"']*\d{4}-\d{2}-\d{2}[^"']*["']/i.test(html)) {
    setDocFlag(acc, F.STATEMENT_NO_PUBDATE);
  }

  // ariada/statement/standard-reference
  if (!/WCAG\s+2\.\d|EN\s+301\s+549|Web\s+Content\s+Accessibility\s+Guidelines/i.test(html)) {
    setDocFlag(acc, F.STATEMENT_NO_STANDARD);
  }
}

// eslint-disable-next-line sonarjs/cognitive-complexity -- EAA transport rule pack mirrors the regulatory rule list; refactor deferred
function extractTransport(html: string, acc: FeatureSink): void {
  // ariada/transport/booking-timeout-has-warning
  for (const m of html.matchAll(/<[^>]+\bdata-booking-timeout\b[^>]*>/gi)) {
    const fullTag = m[0];
    const hasWarning = /\bdata-timeout-warning\b/i.test(fullTag);
    const ariaDesc = fullTag.match(/\baria-describedby=["']([^"']+)["']/i)?.[1];
    if (!hasWarning && !ariaDesc) {
      setDocFlag(acc, F.BOOKING_NO_TIMEOUT_WARN);
      break;
    }
    if (ariaDesc) {
      const refContentRe = new RegExp(`id=["']${ariaDesc}["'][^>]*>(\\s*)<`, 'i');
      const refMatch = html.match(refContentRe);
      if (refMatch && (refMatch[1] ?? '').trim() === '') {
        setDocFlag(acc, F.BOOKING_NO_TIMEOUT_WARN);
        break;
      }
    }
  }

  // ariada/transport/fare-table-has-caption
  for (const m of html.matchAll(/<table\b([^>]*)>([\s\S]*?)<\/table>/gi)) {
    const attrs = m[1] ?? '';
    const body = m[2] ?? '';
    if (!/\bdata-fare-table\b/i.test(attrs)) continue;
    const captionMatch = body.match(/<caption\b[^>]*>([\s\S]*?)<\/caption>/i);
    if (!captionMatch || (captionMatch[1] ?? '').replace(/<[^>]*>/g, '').trim() === '') {
      setDocFlag(acc, F.FARE_TABLE_NO_CAPTION);
      break;
    }
  }

  // ariada/transport/live-status-has-live-region
  for (const m of html.matchAll(/<[^>]+\bdata-live-status\b[^>]*>/gi)) {
    const fullTag = m[0] ?? '';
    const ariaLive = fullTag.match(/\baria-live=["']([^"']*)["']/i)?.[1] ?? '';
    const hasValidLive = ariaLive === 'polite' || ariaLive === 'assertive';
    const hasRole = /\brole=["'](status|alert)["']/i.test(fullTag);
    if (!hasValidLive && !hasRole) {
      setDocFlag(acc, F.LIVE_STATUS_NO_LIVE);
      break;
    }
  }

  // ariada/transport/seat-selection-has-accessible-name
  // Use a balanced-tag approach for the container: match <div|section|ul data-seat-map...>...</div>
  // The inner content can have nested elements so we cannot use a lazy [\s\S]*? up to first </X>.
  // Instead, search for the seat-map opening tag and extract the slice of HTML that follows,
  // then scan ALL buttons and inputs within it (stopping at the first non-seat content).
  {
    const seatMapOpenRe = /<(div|section|ul|nav|main|article)\b([^>]*)\bdata-seat-map\b([^>]*)>/gi;
    for (const openMatch of html.matchAll(seatMapOpenRe)) {
      const tag = openMatch[1] ?? 'div';
      const startIdx = (openMatch.index ?? 0) + openMatch[0].length;
      // Extract the full inner content by finding the matching closing tag.
      // We do a simple forward search counting nesting for the same tag.
      const closeTag = `</${tag}`;
      let depth = 1;
      let searchFrom = startIdx;
      let endIdx = html.length;
      while (depth > 0 && searchFrom < html.length) {
        const nextOpen = html.indexOf(`<${tag}`, searchFrom);
        const nextClose = html.indexOf(closeTag, searchFrom);
        if (nextClose === -1) { endIdx = html.length; break; }
        if (nextOpen !== -1 && nextOpen < nextClose) {
          depth++;
          searchFrom = nextOpen + 1;
        } else {
          depth--;
          if (depth === 0) { endIdx = nextClose; }
          searchFrom = nextClose + 1;
        }
      }
      const seatBody = html.slice(startIdx, endIdx);
      // buttons
      for (const btnMatch of seatBody.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/gi)) {
        const attrs = btnMatch[1] ?? '';
        const btnText = (btnMatch[2] ?? '').replace(/<[^>]*>/g, '').trim();
        const hasName = /\baria-label=["'][^"']+["']/i.test(attrs) || /\baria-labelledby=["'][^"']+["']/i.test(attrs);
        if (!btnText && !hasName) {
          setDocFlag(acc, F.SEAT_NO_NAME);
          break;
        }
      }
      // checkboxes/radios
      for (const inputMatch of seatBody.matchAll(/<input\b([^>]*)>/gi)) {
        const attrs = inputMatch[1] ?? '';
        const inputType = attrs.match(/\btype=["']([^"']*)["']/i)?.[1]?.toLowerCase() ?? 'text';
        if (inputType !== 'checkbox' && inputType !== 'radio') continue;
        const hasName = /\baria-label=["'][^"']+["']/i.test(attrs) || /\baria-labelledby=["'][^"']+["']/i.test(attrs);
        const inputId = attrs.match(/\bid=["']([^"']+)["']/i)?.[1];
        const hasLabel = inputId ? new RegExp(`<label[^>]*\\bfor=["']${inputId}["']`, 'i').test(html) : false;
        if (!hasName && !hasLabel) {
          setDocFlag(acc, F.SEAT_NO_NAME);
          break;
        }
      }
    }
  }

  // ariada/transport/timetable-has-header-cells
  for (const m of html.matchAll(/<table\b([^>]*)>([\s\S]*?)<\/table>/gi)) {
    const attrs = m[1] ?? '';
    const body = m[2] ?? '';
    if (!/\bdata-timetable\b/i.test(attrs)) continue;
    if (!/<th\b/i.test(body)) {
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
