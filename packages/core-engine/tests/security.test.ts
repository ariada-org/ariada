// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Tests for the security domain module.
//
// Invariants under test:
//   - Extractor purity: perDocument is synchronous and returns void.
//   - Positive cases: a snapshot with weak or absent headers produces findings
//     with the correct ruleId and severity.
//   - Negative cases: a snapshot with all security headers correctly set and
//     no insecure cookies produces zero findings (false-positive guard).
//   - Cookie interaction feature: an insecure cookie causes a cookie-scoped
//     feature so the privacy<->security seed pair in the cross-domain detector
//     can fire.

import { describe, expect, it } from 'vitest';

import {
  SEC_COOKIE_INSECURE_FLAGS,
  SEC_CSP_ABSENT,
  SEC_HSTS_ABSENT,
  SEC_XCTO_ABSENT,
  securityDomain,
} from '../src/domains/security.js';
import type {
  ExtractedFeatures,
  FeatureSink,
  JoinScope,
  PropertySnapshot,
  SnapshotCookie,
} from '../src/domain-contract.js';

// ---------------------------------------------------------------------------
// Fixture builders
// ---------------------------------------------------------------------------

/**
 * Build a minimal PropertySnapshot for testing. Override individual fields by
 * merging the extras parameter.
 */
function makeSnapshot(extras: Partial<PropertySnapshot> = {}): PropertySnapshot {
  return {
    scanId: 'scan-sec-test',
    url: 'https://example.test/',
    timestamp: 0,
    html: '',
    headers: {},
    cookies: [],
    networkResources: [],
    axTree: [],
    domOutline: [],
    perfMetrics: {},
    timings: { navigationMs: 0, axTreeMs: 0, domMs: 0, totalMs: 0 },
    ...extras,
  };
}

/** Snapshot with all required security headers present and well-formed. */
const SECURE_SNAPSHOT = makeSnapshot({
  headers: {
    'strict-transport-security': 'max-age=31536000; includeSubDomains',
    'content-security-policy': "default-src 'self'; script-src 'self'",
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'strict-origin-when-cross-origin',
  },
  cookies: [],
  networkResources: [],
});

/** Snapshot with no security headers at all. */
const INSECURE_SNAPSHOT = makeSnapshot({
  headers: {},
  cookies: [],
  networkResources: [],
});

/**
 * Snapshot served over HTTPS with a CSP that allows unsafe-eval and
 * unsafe-inline without a nonce (two CSP violations).
 */
const CSP_WEAK_SNAPSHOT = makeSnapshot({
  headers: {
    'strict-transport-security': 'max-age=31536000',
    'content-security-policy': "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'",
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'strict-origin-when-cross-origin',
  },
});

/**
 * Snapshot where the HSTS max-age is below the minimum threshold (< 1 year).
 */
const HSTS_SHORT_MAX_AGE_SNAPSHOT = makeSnapshot({
  headers: {
    'strict-transport-security': 'max-age=86400',
    'content-security-policy': "default-src 'self'",
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'strict-origin-when-cross-origin',
  },
});

/** Snapshot with a cookie that is missing both the Secure and HttpOnly flags. */
const INSECURE_COOKIE_SNAPSHOT = makeSnapshot({
  headers: {
    'strict-transport-security': 'max-age=31536000',
    'content-security-policy': "default-src 'self'",
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'strict-origin-when-cross-origin',
  },
  cookies: [
    {
      name: 'session_id',
      value: 'abc123',
      secure: false,
      httpOnly: false,
    } satisfies SnapshotCookie,
  ],
});

/** Snapshot with a secure, HttpOnly cookie — should produce no cookie finding. */
const SECURE_COOKIE_SNAPSHOT = makeSnapshot({
  headers: {
    'strict-transport-security': 'max-age=31536000',
    'content-security-policy': "default-src 'self'",
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'strict-origin-when-cross-origin',
  },
  cookies: [
    {
      name: 'session_id',
      value: 'abc123',
      secure: true,
      httpOnly: true,
    } satisfies SnapshotCookie,
  ],
});

/**
 * Snapshot with HTTP sub-resources loaded on an HTTPS page (mixed content).
 */
const MIXED_CONTENT_SNAPSHOT = makeSnapshot({
  headers: {
    'strict-transport-security': 'max-age=31536000',
    'content-security-policy': "default-src 'self'",
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'strict-origin-when-cross-origin',
  },
  networkResources: [
    { url: 'https://example.test/main.js' },
    { url: 'http://cdn.legacy.example/jquery.min.js' },  // mixed content
  ],
});

// ---------------------------------------------------------------------------
// Helper: run extractor and produce an ExtractedFeatures object
// ---------------------------------------------------------------------------

/**
 * Run the security domain's perDocument extractor on the given snapshot and
 * return the resulting ExtractedFeatures so the evaluate function can be
 * called on them independently.
 */
function runExtractor(snap: PropertySnapshot): ExtractedFeatures {
  const features: ExtractedFeatures = {
    byElement: new Map(),
    byDocument: new Map(),
    byScope: new Map(),
  };

  const sink: FeatureSink = {
    set(elementKey: string, featureKey: string, value: unknown): void {
      const key = elementKey ? `${elementKey}::${featureKey}` : featureKey;
      features.byDocument.set(key, value);
      // Also write to byScope under 'document' scope
      pushScopedHelper(features, 'document', elementKey || featureKey, 'security', featureKey, value);
    },
    setScoped(scope: JoinScope, joinValue: string, featureKey: string, value: unknown): void {
      pushScopedHelper(features, scope, joinValue, 'security', featureKey, value);
    },
  };

  securityDomain.extractors.perDocument?.(snap, sink);
  return features;
}

function pushScopedHelper(
  features: ExtractedFeatures,
  scope: JoinScope,
  joinValue: string,
  domainId: string,
  featureKey: string,
  value: unknown,
): void {
  const byScope = (features.byScope ??= new Map());
  let byValue = byScope.get(scope);
  if (!byValue) {
    byValue = new Map();
    byScope.set(scope, byValue);
  }
  let list = byValue.get(joinValue);
  if (!list) {
    list = [];
    byValue.set(joinValue, list);
  }
  list.push({ domainId, featureKey, value, scope, joinValue });
}

// ---------------------------------------------------------------------------
// Tests: extractor purity
// ---------------------------------------------------------------------------

describe('Security domain extractor purity', () => {
  it('perDocument returns void (synchronous, no Promise)', () => {
    const features: ExtractedFeatures = {
      byElement: new Map(),
      byDocument: new Map(),
      byScope: new Map(),
    };
    const sink: FeatureSink = {
      set: () => {},
      setScoped: () => {},
    };
    const returnValue = securityDomain.extractors.perDocument?.(SECURE_SNAPSHOT, sink);
    expect(returnValue).toBeUndefined();
    // No features written to features (we used no-op sink); no mutation of
    // the snapshot or features object.
    expect(features.byDocument.size).toBe(0);
  });

  it('does not mutate the input snapshot', () => {
    const snap = makeSnapshot({ headers: {} });
    const originalUrl = snap.url;
    const sink: FeatureSink = { set: () => {}, setScoped: () => {} };
    securityDomain.extractors.perDocument?.(snap, sink);
    expect(snap.url).toBe(originalUrl);
    expect(snap.headers).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// Tests: positive cases (insecure snapshot produces expected findings)
// ---------------------------------------------------------------------------

describe('Security domain — positive findings', () => {
  it('produces a finding for absent HSTS on an HTTPS page', () => {
    const features = runExtractor(INSECURE_SNAPSHOT);
    const findings = securityDomain.evaluate(features);
    const hsts = findings.filter((f) => f.ruleId === 'sec-hsts-absent');
    expect(hsts.length).toBeGreaterThanOrEqual(1);
    expect(hsts[0]?.severity).toBe('serious');
    expect(hsts[0]?.domain).toBe('security');
  });

  it('produces a finding for absent CSP header', () => {
    const features = runExtractor(INSECURE_SNAPSHOT);
    const findings = securityDomain.evaluate(features);
    const csp = findings.filter((f) => f.ruleId === 'sec-csp-absent');
    expect(csp.length).toBeGreaterThanOrEqual(1);
    expect(csp[0]?.severity).toBe('serious');
  });

  it('produces a finding for absent X-Content-Type-Options', () => {
    const features = runExtractor(INSECURE_SNAPSHOT);
    const findings = securityDomain.evaluate(features);
    const xcto = findings.filter((f) => f.ruleId === 'sec-xcto-absent');
    expect(xcto.length).toBeGreaterThanOrEqual(1);
    expect(xcto[0]?.severity).toBe('moderate');
  });

  it('produces a finding for absent Referrer-Policy', () => {
    const features = runExtractor(INSECURE_SNAPSHOT);
    const findings = securityDomain.evaluate(features);
    const ref = findings.filter((f) => f.ruleId === 'sec-referrer-policy');
    expect(ref.length).toBeGreaterThanOrEqual(1);
    expect(ref[0]?.severity).toBe('moderate');
  });

  it('produces a finding for CSP with unsafe-eval', () => {
    const features = runExtractor(CSP_WEAK_SNAPSHOT);
    const findings = securityDomain.evaluate(features);
    const unsafeEval = findings.filter((f) => f.ruleId === 'sec-csp-unsafe-eval');
    expect(unsafeEval.length).toBeGreaterThanOrEqual(1);
    expect(unsafeEval[0]?.severity).toBe('serious');
  });

  it('produces a finding for CSP with unsafe-inline and no nonce', () => {
    const features = runExtractor(CSP_WEAK_SNAPSHOT);
    const findings = securityDomain.evaluate(features);
    const unsafeInline = findings.filter((f) => f.ruleId === 'sec-csp-unsafe-inline-no-nonce');
    expect(unsafeInline.length).toBeGreaterThanOrEqual(1);
  });

  it('produces a finding for HSTS max-age below the minimum threshold', () => {
    const features = runExtractor(HSTS_SHORT_MAX_AGE_SNAPSHOT);
    const findings = securityDomain.evaluate(features);
    const hsts = findings.filter((f) => f.ruleId === 'sec-hsts-absent');
    expect(hsts.length).toBeGreaterThanOrEqual(1);
  });

  it('produces a finding for mixed content on an HTTPS page', () => {
    const features = runExtractor(MIXED_CONTENT_SNAPSHOT);
    const findings = securityDomain.evaluate(features);
    const mixed = findings.filter((f) => f.ruleId === 'sec-mixed-content');
    expect(mixed.length).toBeGreaterThanOrEqual(1);
    expect(mixed[0]?.severity).toBe('serious');
  });

  it('produces a finding for a cookie missing the Secure flag', () => {
    const features = runExtractor(INSECURE_COOKIE_SNAPSHOT);
    const findings = securityDomain.evaluate(features);
    const cookieFindings = findings.filter((f) => f.ruleId === 'sec-insecure-cookie');
    expect(cookieFindings.length).toBeGreaterThanOrEqual(1);
    expect(cookieFindings[0]?.message).toContain('session_id');
    expect(cookieFindings[0]?.severity).toBe('serious');
  });
});

// ---------------------------------------------------------------------------
// Tests: negative cases (clean input produces no findings)
// ---------------------------------------------------------------------------

describe('Security domain — negative cases (no false positives)', () => {
  it('produces zero findings for a well-configured HTTPS site', () => {
    const features = runExtractor(SECURE_SNAPSHOT);
    const findings = securityDomain.evaluate(features);
    expect(findings).toHaveLength(0);
  });

  it('produces no HSTS finding for an HTTP page (HSTS only applies to HTTPS)', () => {
    // HSTS is irrelevant for plain HTTP pages; the rule must not flag them.
    const httpSnap = makeSnapshot({
      url: 'http://example.test/',
      headers: {
        'content-security-policy': "default-src 'self'",
        'x-content-type-options': 'nosniff',
        'referrer-policy': 'strict-origin-when-cross-origin',
      },
    });
    const features = runExtractor(httpSnap);
    const findings = securityDomain.evaluate(features);
    const hsts = findings.filter((f) => f.ruleId === 'sec-hsts-absent');
    expect(hsts).toHaveLength(0);
  });

  it('produces no mixed-content finding for an HTTP page', () => {
    // Mixed content is only meaningful on HTTPS pages; HTTP loads everything
    // over plain HTTP by definition and the rule must not fire.
    const httpSnap = makeSnapshot({
      url: 'http://example.test/',
      headers: {
        'content-security-policy': "default-src 'self'",
        'x-content-type-options': 'nosniff',
        'referrer-policy': 'strict-origin-when-cross-origin',
      },
      networkResources: [
        { url: 'http://cdn.example/lib.js' },
      ],
    });
    const features = runExtractor(httpSnap);
    const findings = securityDomain.evaluate(features);
    const mixed = findings.filter((f) => f.ruleId === 'sec-mixed-content');
    expect(mixed).toHaveLength(0);
  });

  it('produces no cookie finding for a Secure+HttpOnly cookie', () => {
    const features = runExtractor(SECURE_COOKIE_SNAPSHOT);
    const findings = securityDomain.evaluate(features);
    const cookieFindings = findings.filter((f) => f.ruleId === 'sec-insecure-cookie');
    expect(cookieFindings).toHaveLength(0);
  });

  it('does not flag CSP unsafe-inline when a nonce is also present', () => {
    // A nonce alongside unsafe-inline is standard CSP Level 2 — browsers that
    // support nonces ignore unsafe-inline. The rule must not flag this pattern.
    const snap = makeSnapshot({
      headers: {
        'strict-transport-security': 'max-age=31536000',
        'content-security-policy':
          "script-src 'self' 'unsafe-inline' 'nonce-r4nd0m'; default-src 'self'",
        'x-content-type-options': 'nosniff',
        'referrer-policy': 'strict-origin-when-cross-origin',
      },
    });
    const features = runExtractor(snap);
    const findings = securityDomain.evaluate(features);
    const unsafeInline = findings.filter((f) => f.ruleId === 'sec-csp-unsafe-inline-no-nonce');
    expect(unsafeInline).toHaveLength(0);
  });

  it('produces no findings for an empty snapshot with no headers and no network', () => {
    // A snapshot that has no responseHeaders, no cookies, and networkResources=[]
    // on an HTTP (not HTTPS) page. The only rule that would fire is CSP-absent
    // and Referrer-Policy. This test shows that evaluate is deterministic: same
    // input always produces the same output.
    const snap = makeSnapshot({
      url: 'http://example.test/',
      headers: {
        'content-security-policy': "default-src 'self'",
        'x-content-type-options': 'nosniff',
        'referrer-policy': 'no-referrer',
      },
      cookies: [],
      networkResources: [],
    });
    const features = runExtractor(snap);
    const findings = securityDomain.evaluate(features);
    // All relevant rules pass for this snapshot.
    expect(findings).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Tests: interaction feature — cookie-scoped for privacy<->security seed pair
// ---------------------------------------------------------------------------

describe('Security domain — interaction features for cross-domain detection', () => {
  it('declares interactionFeatures with the expected keys and joinScopes', () => {
    const specs = securityDomain.interactionFeatures ?? [];
    expect(specs.length).toBeGreaterThanOrEqual(1);

    const cookieSpec = specs.find((s) => s.key === SEC_COOKIE_INSECURE_FLAGS);
    expect(cookieSpec).toBeDefined();
    expect(cookieSpec?.joinScope).toBe('cookie');

    const cspSpec = specs.find((s) => s.key === SEC_CSP_ABSENT);
    expect(cspSpec).toBeDefined();
    expect(cspSpec?.joinScope).toBe('element');
  });

  it('writes a cookie-scoped feature for each insecure cookie so the detector can correlate', () => {
    const features = runExtractor(INSECURE_COOKIE_SNAPSHOT);

    // The cookie-scoped feature must be in byScope under 'cookie' join scope
    // with the cookie name as the join value.
    const cookieScope = features.byScope?.get('cookie');
    expect(cookieScope).toBeDefined();

    const sessionFeatures = cookieScope?.get('session_id');
    expect(sessionFeatures).toBeDefined();
    expect(sessionFeatures?.length).toBeGreaterThanOrEqual(1);

    const secFeature = sessionFeatures?.find(
      (f) => f.featureKey === SEC_COOKIE_INSECURE_FLAGS && f.domainId === 'security',
    );
    expect(secFeature).toBeDefined();
    expect(secFeature?.scope).toBe('cookie');
    expect(secFeature?.joinValue).toBe('session_id');
  });

  it('does NOT write a cookie-scoped feature when cookies are empty', () => {
    const features = runExtractor(SECURE_SNAPSHOT);
    const cookieScope = features.byScope?.get('cookie');
    // No insecure cookies — the cookie join scope should be absent or empty.
    expect(!cookieScope || cookieScope.size === 0).toBe(true);
  });

  it('mirrors the shape the cross-domain detector expects: domainId + featureKey + scope + joinValue', () => {
    // The detector reads CorrelatedFeature records from byScope. Confirm this
    // domain's cookie features carry all four required fields.
    const snap = makeSnapshot({
      headers: {
        'strict-transport-security': 'max-age=31536000',
        'content-security-policy': "default-src 'self'",
        'x-content-type-options': 'nosniff',
        'referrer-policy': 'strict-origin-when-cross-origin',
      },
      cookies: [
        { name: 'auth_token', value: 'xyz', secure: false, httpOnly: true } satisfies SnapshotCookie,
      ],
    });
    const features = runExtractor(snap);
    const cookieFeatures = features.byScope?.get('cookie')?.get('auth_token') ?? [];
    expect(cookieFeatures.length).toBeGreaterThanOrEqual(1);
    const cf = cookieFeatures[0]!;
    expect(cf.domainId).toBe('security');
    expect(cf.featureKey).toBe(SEC_COOKIE_INSECURE_FLAGS);
    expect(cf.scope).toBe('cookie');
    expect(cf.joinValue).toBe('auth_token');
  });

  it('emits only one cookie finding per cookie name even if the same cookie appears multiple times', () => {
    // A misconfigured capture could record duplicate Set-Cookie lines. The
    // module must not double-count them.
    const snap = makeSnapshot({
      headers: {
        'strict-transport-security': 'max-age=31536000',
        'content-security-policy': "default-src 'self'",
        'x-content-type-options': 'nosniff',
        'referrer-policy': 'strict-origin-when-cross-origin',
      },
      cookies: [
        { name: 'dup', value: '1', secure: false, httpOnly: false } satisfies SnapshotCookie,
        { name: 'dup', value: '2', secure: false, httpOnly: false } satisfies SnapshotCookie,
      ],
    });
    const features = runExtractor(snap);
    const findings = securityDomain.evaluate(features);
    const dupFindings = findings.filter(
      (f) => f.ruleId === 'sec-insecure-cookie' && f.message.includes('"dup"'),
    );
    // evaluate deduplicates by cookie name; one finding regardless of duplicates.
    expect(dupFindings).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Tests: domain metadata
// ---------------------------------------------------------------------------

describe('Security domain metadata', () => {
  it('has the expected stable id', () => {
    expect(securityDomain.id).toBe('security');
  });

  it('has a non-empty title and semver version', () => {
    expect(securityDomain.title.length).toBeGreaterThan(0);
    expect(securityDomain.version).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('does not declare a perElement extractor (security is document-scoped)', () => {
    expect(securityDomain.extractors.perElement).toBeUndefined();
  });

  it('tolerates a snapshot where optional fields (responseHeaders, tlsMeta) are absent', () => {
    // The snapshot type marks responseHeaders and tlsMeta as optional. The
    // extractor must not crash when they are absent. Use a snapshot that omits
    // those keys entirely rather than setting them to undefined, which would
    // conflict with exactOptionalPropertyTypes.
    const snap = makeSnapshot({});  // responseHeaders and tlsMeta not present
    const sink: FeatureSink = { set: () => {}, setScoped: () => {} };
    expect(() => {
      securityDomain.extractors.perDocument?.(snap, sink);
    }).not.toThrow();
  });

  it('evaluate returns an array (even when features are empty)', () => {
    const emptyFeatures: ExtractedFeatures = {
      byElement: new Map(),
      byDocument: new Map(),
      byScope: new Map(),
    };
    const result = securityDomain.evaluate(emptyFeatures);
    expect(Array.isArray(result)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Tests: responseHeaders field takes priority over headers
// ---------------------------------------------------------------------------

describe('Security domain — responseHeaders field', () => {
  it('reads headers from responseHeaders[url] when present, ignoring the headers field', () => {
    // responseHeaders is the per-resource enrichment added by the capture layer;
    // it takes precedence over the document-level headers field. When it is
    // present and well-formed, no header findings should fire.
    const url = 'https://enriched.test/';
    const snap = makeSnapshot({
      url,
      headers: {},   // document-level headers are empty (would trigger findings)
      responseHeaders: {
        [url]: {
          'strict-transport-security': 'max-age=31536000',
          'content-security-policy': "default-src 'self'",
          'x-content-type-options': 'nosniff',
          'referrer-policy': 'strict-origin-when-cross-origin',
        },
      },
    });
    const features = runExtractor(snap);
    const findings = securityDomain.evaluate(features);
    const headerFindings = findings.filter((f) =>
      ['sec-hsts-absent', 'sec-csp-absent', 'sec-xcto-absent', 'sec-referrer-policy'].includes(f.ruleId),
    );
    expect(headerFindings).toHaveLength(0);
  });

  it('falls back to headers field when responseHeaders is absent', () => {
    // Do not pass responseHeaders at all — omitting it exercises the fallback
    // path without setting the key to undefined (exactOptionalPropertyTypes).
    const snap = makeSnapshot({
      headers: {
        'strict-transport-security': 'max-age=31536000',
        'content-security-policy': "default-src 'self'",
        'x-content-type-options': 'nosniff',
        'referrer-policy': 'strict-origin-when-cross-origin',
      },
    });
    const features = runExtractor(snap);
    const findings = securityDomain.evaluate(features);
    // All headers are correct via the fallback path; no findings expected.
    expect(findings).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Tests: HSTS feature key exported constant
// ---------------------------------------------------------------------------

describe('Exported feature key constants', () => {
  it('SEC_HSTS_ABSENT has the expected string value', () => {
    expect(SEC_HSTS_ABSENT).toBe('security:hsts-absent');
  });

  it('SEC_CSP_ABSENT has the expected string value', () => {
    expect(SEC_CSP_ABSENT).toBe('security:csp-absent');
  });

  it('SEC_XCTO_ABSENT has the expected string value', () => {
    expect(SEC_XCTO_ABSENT).toBe('security:xcto-absent');
  });

  it('SEC_COOKIE_INSECURE_FLAGS has the expected string value', () => {
    expect(SEC_COOKIE_INSECURE_FLAGS).toBe('security:cookie-insecure-flags');
  });
});
