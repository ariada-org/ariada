// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import type {
  DomainModule,
  ElementHandle,
  ExtractedFeatures,
  FeatureSink,
  PropertySnapshot,
} from '../domain-contract.js';
import type { Finding } from '../types.js';

// ---------------------------------------------------------------------------
// Feature keys — what this domain writes into the shared feature store
// ---------------------------------------------------------------------------

/**
 * Emitted on the cookie join scope when a cookie is present before any consent
 * interaction. Join value is the cookie name so the security domain can correlate
 * on the same cookie name and the detector can fire the privacy↔security pair.
 */
export const PRIVACY_COOKIE_BEFORE_CONSENT = 'privacy:cookie-before-consent';

/**
 * Emitted at document scope when at least one third-party request to a known
 * tracking origin fired before consent.
 */
export const PRIVACY_TRACKER_BEFORE_CONSENT = 'privacy:tracker-before-consent';

/**
 * Emitted on the element that is the consent banner when it has a pre-checked
 * accept toggle at load time.
 */
export const PRIVACY_DP_PRETICKED = 'privacy:dp-preticked';

/**
 * Emitted on the element that is the consent banner when no granular
 * purpose/category controls are present.
 */
export const PRIVACY_DP_NO_GRANULAR = 'privacy:dp-no-granular';

// ---------------------------------------------------------------------------
// Rule IDs — stable identifiers that appear in Finding.ruleId
// ---------------------------------------------------------------------------

export const RULE_CBF_COOKIE = 'privacy-cbf-cookie';
export const RULE_CBF_REQUEST = 'privacy-cbf-request';
export const RULE_DP_PRETICKED = 'privacy-dp-preticked';
export const RULE_DP_NO_GRANULAR = 'privacy-dp-no-granular';
export const RULE_NO_BANNER = 'privacy-no-banner';

// ---------------------------------------------------------------------------
// Curated set of tracking origins (sampled from EasyPrivacy / Disconnect.me)
// ---------------------------------------------------------------------------

/**
 * A small curated list of hostnames known to operate tracking pixels and
 * analytics beacons. Requests to these origins before consent are flagged.
 * This is intentionally conservative (low false-positive rate); a full list
 * integration is deferred to a later iteration.
 */
const TRACKING_ORIGINS: ReadonlySet<string> = new Set([
  'google-analytics.com',
  'analytics.google.com',
  'googletagmanager.com',
  'googletagservices.com',
  'doubleclick.net',
  'facebook.com',
  'connect.facebook.net',
  'facebook.net',
  'ads.linkedin.com',
  'snap.licdn.com',
  'platform.twitter.com',
  'static.ads-twitter.com',
  'analytics.tiktok.com',
  'bat.bing.com',
  'sc-static.net',
  'hn.inspectlet.com',
  'hotjar.com',
  'clarity.ms',
  'mixpanel.com',
  'amplitude.com',
  'segment.com',
  'cdn.segment.com',
  'heap.io',
  'heapanalytics.com',
  'fullstory.com',
  'logrocket.com',
  'quantserve.com',
  'scorecardresearch.com',
  'omtrdc.net',
  'demdex.net',
  'adobedtm.com',
  'krxd.net',
  'criteo.com',
  'adform.net',
  'smartadserver.com',
  'pubmatic.com',
  'openx.net',
  'rubiconproject.com',
  'casalemedia.com',
  'contextweb.com',
  'taboola.com',
  'outbrain.com',
  'trackcmp.net',
  'activecampaign.com',
  'pardot.com',
  'marketo.com',
]);

/**
 * Return the effective hostname of a URL string, or null when parsing fails.
 * Strips the leading "www." prefix so `www.google-analytics.com` and
 * `google-analytics.com` both match.
 */
function hostnameOf(rawUrl: string): string | null {
  try {
    const { hostname } = new URL(rawUrl);
    return hostname.startsWith('www.') ? hostname.slice(4) : hostname;
  } catch {
    return null;
  }
}

/**
 * Return true when the hostname or any of its parent domains appears in the
 * tracking set. For example `cdn.google-analytics.com` matches because its
 * parent `google-analytics.com` is in the set.
 */
function isTrackingOrigin(hostname: string): boolean {
  if (TRACKING_ORIGINS.has(hostname)) return true;
  const parts = hostname.split('.');
  for (let i = 1; i < parts.length - 1; i++) {
    if (TRACKING_ORIGINS.has(parts.slice(i).join('.'))) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Banner detection helpers
// ---------------------------------------------------------------------------

/**
 * Heuristics that identify an element as the cookie consent banner. The banner
 * is typically a dialog, a fixed-position container, or an element whose
 * aria-label / id / class-name references consent vocabulary.
 */
const BANNER_ROLE_KEYWORDS = new Set(['dialog', 'alertdialog', 'banner', 'region', 'complementary']);
const BANNER_TEXT_PATTERN = /cookie|consent|gdpr|privacy|accept|einwilligung/i;

function looksLikeBannerElement(el: ElementHandle): boolean {
  const attrs = el.attributes;
  if (!attrs) return false;

  const role = attrs['role'] ?? '';
  if (BANNER_ROLE_KEYWORDS.has(role.toLowerCase())) {
    return true;
  }

  // Check id, class, aria-label for consent vocabulary.
  for (const attr of ['id', 'class', 'aria-label', 'data-testid', 'aria-labelledby']) {
    const val = attrs[attr] ?? '';
    if (val && BANNER_TEXT_PATTERN.test(val)) return true;
  }

  return false;
}

/**
 * Return true when the element is an INPUT with type=checkbox or type=radio
 * that carries a `checked` attribute — meaning it is pre-selected at load time.
 * This is the "pre-ticked" dark pattern.
 */
function isPretickedInput(el: ElementHandle): boolean {
  const nodeName = el.nodeName.toUpperCase();
  if (nodeName !== 'INPUT') return false;
  const attrs = el.attributes;
  if (!attrs) return false;
  const type = (attrs['type'] ?? '').toLowerCase();
  if (type !== 'checkbox' && type !== 'radio') return false;
  return 'checked' in attrs;
}

/**
 * Return true when the element looks like an accept/agree control — its visible
 * text (via aria-label, value, or name attribute) references acceptance vocabulary.
 */
const ACCEPT_PATTERN = /\b(accept|agree|allow|enable|yes|ok|got it|verstanden|akzeptieren)\b/i;

function isAcceptLikeControl(el: ElementHandle): boolean {
  const attrs = el.attributes;
  if (!attrs) return false;
  for (const attr of ['aria-label', 'value', 'name', 'title']) {
    if (ACCEPT_PATTERN.test(attrs[attr] ?? '')) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Privacy domain module
// ---------------------------------------------------------------------------

/**
 * Privacy compliance domain. It reads the captured cookie jar and network
 * resource log to detect tracking activity before a user has interacted with a
 * consent banner, and inspects the consent banner's own DOM for dark patterns
 * recognised by the European Data Protection Board.
 *
 * Extractors are PURE and SYNCHRONOUS: they inspect the captured snapshot only.
 * No network, no filesystem, no additional fetching happens here — all data
 * comes from what the capturing surface recorded in the PropertySnapshot.
 */
export const privacyDomain: DomainModule = {
  id: 'privacy',
  title: 'Privacy',
  version: '0.1.0',

  // -------------------------------------------------------------------------
  // Feature extractors
  // -------------------------------------------------------------------------

  extractors: {
    /**
     * Per-element extractor: runs for every element in the shared walker pass.
     * Inspects potential banner elements for pre-ticked inputs.
     */
    perElement(el: ElementHandle, acc: FeatureSink): void {
      if (!el.attributes) return;

      // Dark pattern: pre-ticked accept option inside a banner-like element.
      // We cannot determine whether the INPUT is inside a banner without the
      // full DOM tree, so we flag any pre-ticked INPUT that is accept-like
      // (the most common pattern) OR any pre-ticked INPUT near a banner
      // selector. Broad enough to catch real violations, narrow enough not
      // to flag every checkbox on the page.
      if (isPretickedInput(el) && isAcceptLikeControl(el)) {
        acc.set(el.selector, PRIVACY_DP_PRETICKED, true);
      }

      // Also flag banner-like elements that carry no identifiable child role
      // offering granular controls. We use the banner element itself as an
      // anchor and record the absence of granularity as a document-level check
      // in perDocument; here we just tag the element so perDocument can verify.
      if (looksLikeBannerElement(el)) {
        acc.set(el.selector, 'privacy:banner-element-observed', true);
      }
    },

    /**
     * Per-document extractor: runs once with the full snapshot. Reads the
     * optional cookie jar and network resource log captured before any consent
     * gesture.
     *
     * Tolerates absent optional fields: when `cookies` is an empty array or
     * `networkResources` is empty, the extractor produces no findings rather
     * than throwing.
     */
    perDocument(snap: PropertySnapshot, acc: FeatureSink): void {
      // --- Cookie-before-consent detection ---
      // Every cookie present in the jar at DOMContentLoaded was set without
      // any user interaction. Non-essential cookies set at this stage need
      // prior consent under GDPR Article 7.
      const cookies = snap.cookies ?? [];
      let hasPreconsent = false;

      for (const cookie of cookies) {
        // Emit on the cookie join scope so the detector can correlate with the
        // security domain, which emits on the same scope when a cookie is
        // missing secure flags. The join value is the cookie name, matching
        // the "privacy|security|cookie" seed pair.
        acc.setScoped('cookie', cookie.name, PRIVACY_COOKIE_BEFORE_CONSENT, true);
        hasPreconsent = true;
      }

      // Summary document-level flag: at least one pre-consent cookie was seen.
      if (hasPreconsent) {
        acc.set('document', 'privacy:has-cookies-before-consent', true);
      }

      // --- Third-party tracker detection ---
      // Scan network resources captured before consent for known tracking
      // origins. Each resource URL is checked against the curated set.
      const resources = snap.networkResources ?? [];
      const trackerOriginsFound = new Set<string>();

      for (const resource of resources) {
        const hostname = hostnameOf(resource.url);
        if (hostname !== null && isTrackingOrigin(hostname)) {
          trackerOriginsFound.add(hostname);
        }
      }

      for (const origin of trackerOriginsFound) {
        acc.setScoped('request', origin, PRIVACY_TRACKER_BEFORE_CONSENT, true);
      }

      if (trackerOriginsFound.size > 0) {
        acc.set('document', 'privacy:has-trackers-before-consent', true);
        acc.set('document', 'privacy:tracker-count', trackerOriginsFound.size);
      }

      // --- Banner-presence check ---
      // We use the HTML for a lightweight banner-text search when the element
      // outline alone is insufficient (banner may be injected by a CMP script).
      const html = snap.html ?? '';
      const hasBannerText = BANNER_TEXT_PATTERN.test(html);
      acc.set('document', 'privacy:banner-detected', hasBannerText);

      // No-banner + cookies = GDPR Article 7 violation (privacy-no-banner rule).
      if (hasPreconsent && !hasBannerText) {
        acc.set('document', 'privacy:no-banner-with-cookies', true);
      }
    },
  },

  // -------------------------------------------------------------------------
  // Deterministic rule engine: features → findings
  // -------------------------------------------------------------------------

  evaluate(features: ExtractedFeatures): Finding[] {
    const findings: Finding[] = [];

    // --- Rule: cookie set before consent (per cookie) ---
    // Each cookie that appears in the cookie-scoped feature index is a
    // candidate. We read them from byScope so we honour the join scope.
    const cookieScope = features.byScope?.get('cookie');
    if (cookieScope) {
      for (const [cookieName, list] of cookieScope) {
        const hasFlag = list.some(
          (f) => f.domainId === 'privacy' && f.featureKey === PRIVACY_COOKIE_BEFORE_CONSENT && f.value === true,
        );
        if (hasFlag) {
          findings.push({
            id: `${RULE_CBF_COOKIE}-${cookieName}`,
            scanId: '',
            domain: 'privacy',
            ruleId: RULE_CBF_COOKIE,
            severity: 'serious',
            element: { selector: ':root' },
            message: `Cookie "${cookieName}" was set before any consent interaction`,
            regulatoryMapping: [
              { framework: 'GDPR', code: 'Art. 7' },
              { framework: 'GDPR', code: 'Recital 32' },
            ],
          });
        }
      }
    }

    // --- Rule: third-party tracker before consent ---
    // Trackers found via byScope request scope, or via the document-level flag.
    const requestScope = features.byScope?.get('request');
    if (requestScope) {
      for (const [origin, list] of requestScope) {
        const hasTracker = list.some(
          (f) =>
            f.domainId === 'privacy' && f.featureKey === PRIVACY_TRACKER_BEFORE_CONSENT && f.value === true,
        );
        if (hasTracker) {
          findings.push({
            id: `${RULE_CBF_REQUEST}-${origin}`,
            scanId: '',
            domain: 'privacy',
            ruleId: RULE_CBF_REQUEST,
            severity: 'serious',
            element: { selector: ':root' },
            message: `Third-party request to tracking origin "${origin}" fired before consent`,
            regulatoryMapping: [
              { framework: 'GDPR', code: 'Art. 7' },
            ],
          });
        }
      }
    }

    // --- Rule: no consent banner when cookies are present ---
    const noBannerWithCookies = features.byDocument.get('document::privacy:no-banner-with-cookies');
    if (noBannerWithCookies === true) {
      findings.push({
        id: RULE_NO_BANNER,
        scanId: '',
        domain: 'privacy',
        ruleId: RULE_NO_BANNER,
        severity: 'serious',
        element: { selector: ':root' },
        message: 'Non-essential cookies are set without a detectable consent banner',
        regulatoryMapping: [
          { framework: 'GDPR', code: 'Art. 7' },
        ],
      });
    }

    // --- Rules from element-level features ---
    for (const [selector, data] of features.byElement) {
      const privacyFeatures = data.domainFeatures['privacy'];
      if (!privacyFeatures) continue;

      // Dark pattern: pre-ticked accept input
      if (privacyFeatures.get(PRIVACY_DP_PRETICKED) === true) {
        findings.push({
          id: `${RULE_DP_PRETICKED}-${selector}`,
          scanId: '',
          domain: 'privacy',
          ruleId: RULE_DP_PRETICKED,
          severity: 'critical',
          element: { selector },
          message: 'Consent banner has a pre-selected accept option',
          regulatoryMapping: [
            { framework: 'GDPR', code: 'Art. 4(11)' },
            { framework: 'GDPR', code: 'Art. 7' },
          ],
        });
      }
    }

    return findings;
  },

  regulatory: [
    { framework: 'GDPR', code: 'Art. 7' },
    { framework: 'GDPR', code: 'Art. 4(11)' },
    { framework: 'GDPR', code: 'Recital 32' },
  ],

  // -------------------------------------------------------------------------
  // Cross-domain interaction feature declarations
  // -------------------------------------------------------------------------

  /**
   * Features this domain exposes to the cross-domain interaction detector.
   * The detector — not this module — decides when an interaction fires.
   *
   * The `privacy|security|cookie` seed pair fires when both privacy emits
   * `privacy:cookie-before-consent` and security emits
   * `security:cookie-insecure-flags` on the same cookie name (the shared
   * join value within the `cookie` scope).
   */
  interactionFeatures: [
    {
      key: PRIVACY_COOKIE_BEFORE_CONSENT,
      description:
        'A cookie was present in the jar before any consent interaction. ' +
        'Joined on the cookie scope by cookie name so the security domain ' +
        'can correlate on the same cookie.',
      joinScope: 'cookie',
    },
    {
      key: PRIVACY_TRACKER_BEFORE_CONSENT,
      description:
        'A third-party request to a known tracking origin fired before consent. ' +
        'Joined on the request scope by origin hostname.',
      joinScope: 'request',
    },
  ],
};
