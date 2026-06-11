// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import type {
  DomainModule,
  ExtractedFeatures,
  FeatureSink,
  PropertySnapshot,
} from '../domain-contract.js';
import type { Finding } from '../types.js';

// ---------------------------------------------------------------------------
// Feature key constants
// ---------------------------------------------------------------------------

/** Feature key written when HSTS header is absent or has a short max-age. */
export const SEC_HSTS_ABSENT = 'security:hsts-absent';

/** Feature key written when CSP header is absent. */
export const SEC_CSP_ABSENT = 'security:csp-absent';

/** Feature key written when a CSP allows unsafe-eval. */
export const SEC_CSP_UNSAFE_EVAL = 'security:csp-unsafe-eval';

/**
 * Feature key written when CSP allows unsafe-inline scripts without a nonce or
 * hash to mitigate the risk.
 */
export const SEC_CSP_UNSAFE_INLINE_NO_NONCE = 'security:csp-unsafe-inline-no-nonce';

/** Feature key written when X-Content-Type-Options is absent or wrong. */
export const SEC_XCTO_ABSENT = 'security:xcto-absent';

/** Feature key written when Referrer-Policy is absent or set to unsafe-url. */
export const SEC_REFERRER_POLICY_WEAK = 'security:referrer-policy-weak';

/**
 * Feature key written per insecure cookie (missing Secure or HttpOnly flag).
 * The join value used with setScoped is the cookie name, enabling the
 * privacy<->security seed pair in the cross-domain detector.
 */
export const SEC_COOKIE_INSECURE_FLAGS = 'security:cookie-insecure-flags';

/**
 * Feature key written when there are mixed-content resources (HTTP sub-resources
 * on an HTTPS page).
 */
export const SEC_MIXED_CONTENT = 'security:mixed-content';

// ---------------------------------------------------------------------------
// Rule id constants
// ---------------------------------------------------------------------------

const RULE_HSTS_ABSENT = 'sec-hsts-absent';
const RULE_CSP_ABSENT = 'sec-csp-absent';
const RULE_CSP_UNSAFE_EVAL = 'sec-csp-unsafe-eval';
const RULE_CSP_UNSAFE_INLINE_NO_NONCE = 'sec-csp-unsafe-inline-no-nonce';
const RULE_XCTO_ABSENT = 'sec-xcto-absent';
const RULE_REFERRER_POLICY = 'sec-referrer-policy';
const RULE_MIXED_CONTENT = 'sec-mixed-content';
const RULE_INSECURE_COOKIE = 'sec-insecure-cookie';

// ---------------------------------------------------------------------------
// Internal helpers — pure, synchronous, no I/O
// ---------------------------------------------------------------------------

/** Minimum HSTS max-age considered adequate (1 year in seconds). */
const HSTS_MIN_MAX_AGE = 31_536_000;

/**
 * Parse the max-age value from a Strict-Transport-Security header string.
 * Returns the numeric value or -1 if the directive is absent or malformed.
 */
function parseHstsMaxAge(headerValue: string): number {
  const match = /max-age\s*=\s*(\d+)/i.exec(headerValue);
  if (!match?.[1]) return -1;
  return parseInt(match[1], 10);
}

/**
 * Whether the CSP source list for `script-src` (or the fallback `default-src`)
 * contains `unsafe-eval`. A CSP that omits both directives returns false because
 * the caller checks CSP presence separately via SEC_CSP_ABSENT.
 */
function cspHasUnsafeEval(cspValue: string): boolean {
  return /'unsafe-eval'/.test(cspValue);
}

/**
 * Whether the CSP permits `unsafe-inline` without a nonce or hash to limit the
 * scope. A CSP with `unsafe-inline` AND at least one nonce (`nonce-`) or hash
 * (`sha256-`, `sha384-`, `sha512-`) is acceptable because browsers that support
 * CSP Level 2+ ignore `unsafe-inline` when a nonce/hash is also present.
 */
function cspHasUnsafeInlineWithoutMitigation(cspValue: string): boolean {
  if (!/'unsafe-inline'/.test(cspValue)) return false;
  // A nonce or hash token in the same policy limits the unsafe-inline risk.
  const hasMitigation = /'nonce-[^']+'/i.test(cspValue)
    || /'sha(?:256|384|512)-[^']+'/i.test(cspValue);
  return !hasMitigation;
}

// ---------------------------------------------------------------------------
// perDocument extractor
// ---------------------------------------------------------------------------

/**
 * Normalise the primary response headers for the document URL into a
 * lower-cased key map. Prefers the per-resource enrichment field when present,
 * falls back to the document-level headers field.
 */
function resolveHeaders(snap: PropertySnapshot): Record<string, string> {
  const primary: Record<string, string> = snap.responseHeaders?.[snap.url]
    ?? snap.headers
    ?? {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(primary)) {
    out[k.toLowerCase()] = v;
  }
  return out;
}

/**
 * Write HSTS and CSP document-scoped features. Each feature is stored under
 * the bare feature key (empty element key so the document sink does not prefix
 * it) so that `evaluate` can read it directly from `byDocument`.
 */
function extractHeaderFeatures(
  headers: Record<string, string>,
  isHttps: boolean,
  acc: FeatureSink,
): void {
  // HSTS — only meaningful on HTTPS pages.
  if (isHttps) {
    const hstsValue = headers['strict-transport-security'];
    if (!hstsValue || parseHstsMaxAge(hstsValue) < HSTS_MIN_MAX_AGE) {
      acc.set('', SEC_HSTS_ABSENT, true);
    }
  }

  // CSP
  const cspValue = headers['content-security-policy'] ?? '';
  if (!cspValue) {
    acc.set('', SEC_CSP_ABSENT, true);
  } else {
    if (cspHasUnsafeEval(cspValue)) acc.set('', SEC_CSP_UNSAFE_EVAL, true);
    if (cspHasUnsafeInlineWithoutMitigation(cspValue)) acc.set('', SEC_CSP_UNSAFE_INLINE_NO_NONCE, true);
  }

  // X-Content-Type-Options
  const xcto = headers['x-content-type-options'] ?? '';
  if (xcto.trim().toLowerCase() !== 'nosniff') acc.set('', SEC_XCTO_ABSENT, true);

  // Referrer-Policy
  const referrer = headers['referrer-policy'] ?? '';
  if (!referrer || referrer.trim().toLowerCase() === 'unsafe-url') {
    acc.set('', SEC_REFERRER_POLICY_WEAK, true);
  }
}

/**
 * Write cookie-scoped features for each cookie missing the Secure or HttpOnly
 * flag. Uses `setScoped` with `joinScope='cookie'` and the cookie name as the
 * join value so the cross-domain detector can correlate with the privacy domain
 * (the privacy<->security seed pair).
 */
function extractCookieFeatures(snap: PropertySnapshot, acc: FeatureSink): void {
  for (const cookie of snap.cookies) {
    const missingSecure = !cookie.secure;
    const missingHttpOnly = !cookie.httpOnly;
    if (missingSecure || missingHttpOnly) {
      acc.setScoped('cookie', cookie.name, SEC_COOKIE_INSECURE_FLAGS, {
        missingSecure,
        missingHttpOnly,
      });
    }
  }
}

/**
 * Extract security features from the response headers and network resources
 * captured in the snapshot. Writes document-scoped features (one per header
 * rule) and cookie-scoped features (one per insecure cookie) so the
 * cross-domain detector can correlate on cookie name.
 *
 * This extractor is pure and synchronous: no network calls, no filesystem
 * access, no additional fetching. All data comes from the already-captured
 * snapshot.
 */
function extractSecurityFeatures(snap: PropertySnapshot, acc: FeatureSink): void {
  const headers = resolveHeaders(snap);
  const isHttps = snap.url.startsWith('https://');

  extractHeaderFeatures(headers, isHttps, acc);
  extractCookieFeatures(snap, acc);

  // Mixed content — only meaningful on HTTPS pages.
  if (isHttps) {
    const hasMixedContent = snap.networkResources.some(
      (r) => typeof r.url === 'string' && r.url.startsWith('http://'),
    );
    if (hasMixedContent) acc.set('', SEC_MIXED_CONTENT, true);
  }
}

// ---------------------------------------------------------------------------
// evaluate — features -> findings
// ---------------------------------------------------------------------------

/** Static mapping from feature key to rule id + severity + message. */
const DOC_RULES: ReadonlyArray<readonly [string, string, Finding['severity'], string]> = [
  [SEC_HSTS_ABSENT,              RULE_HSTS_ABSENT,              'serious',  'Strict-Transport-Security header is absent or max-age is less than one year'],
  [SEC_CSP_ABSENT,               RULE_CSP_ABSENT,               'serious',  'Content-Security-Policy header is absent'],
  [SEC_CSP_UNSAFE_EVAL,          RULE_CSP_UNSAFE_EVAL,          'serious',  "Content-Security-Policy contains 'unsafe-eval' in a script source list"],
  [SEC_CSP_UNSAFE_INLINE_NO_NONCE, RULE_CSP_UNSAFE_INLINE_NO_NONCE, 'serious', "Content-Security-Policy allows 'unsafe-inline' without a nonce or hash to mitigate the risk"],
  [SEC_XCTO_ABSENT,              RULE_XCTO_ABSENT,              'moderate', 'X-Content-Type-Options: nosniff header is absent'],
  [SEC_REFERRER_POLICY_WEAK,     RULE_REFERRER_POLICY,          'moderate', 'Referrer-Policy header is absent or set to unsafe-url'],
  [SEC_MIXED_CONTENT,            RULE_MIXED_CONTENT,            'serious',  'Page is served over HTTPS but loads sub-resources over HTTP (mixed content)'],
];

/**
 * Produce findings for insecure cookies from the cookie join scope. One finding
 * per unique cookie name; deduplicates when the same name appears multiple times.
 */
function evaluateCookieFindings(features: ExtractedFeatures): Finding[] {
  const findings: Finding[] = [];
  const cookieScope = features.byScope?.get('cookie');
  if (!cookieScope) return findings;
  const seenCookies = new Set<string>();
  for (const [cookieName, featureList] of cookieScope) {
    const f = featureList.find(
      (x) => x.featureKey === SEC_COOKIE_INSECURE_FLAGS && !seenCookies.has(cookieName),
    );
    if (!f) continue;
    seenCookies.add(cookieName);
    const flags = f.value as { missingSecure?: boolean; missingHttpOnly?: boolean };
    const parts: string[] = [];
    if (flags.missingSecure) parts.push('Secure');
    if (flags.missingHttpOnly) parts.push('HttpOnly');
    findings.push({
      id: `${RULE_INSECURE_COOKIE}-${cookieName}`,
      scanId: '',
      domain: 'security',
      ruleId: RULE_INSECURE_COOKIE,
      severity: 'serious',
      element: { selector: ':root' },
      message: `Cookie "${cookieName}" is missing flag(s): ${parts.join(', ')}`,
      regulatoryMapping: [{ framework: 'GDPR', code: 'Art. 32' }],
    });
  }
  return findings;
}

/**
 * Derive `Finding[]` from the features recorded by the extractor. Each rule
 * maps a single feature key to a finding with the appropriate severity.
 * Document-scoped findings use `:root` as the element selector.
 */
function evaluate(features: ExtractedFeatures): Finding[] {
  const docFeatures = features.byDocument;
  const findings: Finding[] = DOC_RULES
    .filter(([featureKey]) => docFeatures.get(featureKey))
    .map(([, ruleId, severity, message]) => makeFinding(ruleId, severity, message));
  return findings.concat(evaluateCookieFindings(features));
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function makeFinding(ruleId: string, severity: Finding['severity'], message: string): Finding {
  return {
    id: `${ruleId}-document`,
    scanId: '',
    domain: 'security',
    ruleId,
    severity,
    element: { selector: ':root' },
    message,
    regulatoryMapping: [{ framework: 'EAA', code: 'Annex I §6' }],
  };
}

// ---------------------------------------------------------------------------
// Exported domain constant
// ---------------------------------------------------------------------------

/**
 * Security domain module. Checks HTTP response headers (HSTS, CSP,
 * X-Content-Type-Options, Referrer-Policy), cookie security flags, and
 * mixed-content loading. Reads `PropertySnapshot.responseHeaders`,
 * `PropertySnapshot.headers`, and `PropertySnapshot.cookies` — all of which
 * are optional enrichment fields that may be absent on minimal snapshots; the
 * extractor tolerates absence gracefully.
 *
 * Participates in two seed interactions:
 *   - accessibility<->security (element scope): a CSP directive blocks a
 *     script an assistive technology relies on. The accessibility domain emits
 *     element-scoped features for the blocked script element; this domain's
 *     CSP absence/weakness feature on the same element lets the detector fire.
 *   - privacy<->security (cookie scope): a cookie that is both missing consent
 *     gating (privacy domain) and missing the Secure/HttpOnly flags (this
 *     domain) is a single fix with dual effect. The join scope is 'cookie' and
 *     the join value is the cookie name.
 */
export const securityDomain: DomainModule = {
  id: 'security',
  title: 'Security',
  version: '0.1.0',

  extractors: {
    perDocument(snap: PropertySnapshot, acc: FeatureSink): void {
      extractSecurityFeatures(snap, acc);
    },
  },

  evaluate,

  regulatory: [
    { framework: 'EAA', code: 'Annex I §6' },
    { framework: 'GDPR', code: 'Art. 32' },
  ],

  interactionFeatures: [
    {
      key: SEC_CSP_ABSENT,
      description: 'CSP is absent, meaning no script-src restrictions are enforced; '
        + 'a tightened policy could block scripts that assistive technology relies on',
      joinScope: 'element',
    },
    {
      key: SEC_CSP_UNSAFE_INLINE_NO_NONCE,
      description: 'CSP allows unsafe-inline scripts without a nonce; '
        + 'tightening this blocks inline scripts that assistive technology injects',
      joinScope: 'element',
    },
    {
      key: SEC_COOKIE_INSECURE_FLAGS,
      description: 'Cookie is missing Secure or HttpOnly flag; '
        + 'adding flags and deferring the cookie until consent is a single fix '
        + 'that improves both security and privacy',
      joinScope: 'cookie',
    },
  ],
};
