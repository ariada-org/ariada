// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Unit tests for the privacy domain module.
//
// Invariants under test:
//   - Extractors are pure and synchronous: no I/O, no return value other than void.
//   - Positive case: a snapshot with cookies present and no banner → findings emitted.
//   - Negative case: a snapshot with no cookies and no trackers → zero findings,
//     proving a clean page produces no false positives.
//   - Interaction-feature case: a cookie-scoped feature is emitted with the right
//     joinScope ('cookie') and joinValue (the cookie name) so the cross-domain
//     detector can fire the privacy↔security seed pair.

import { describe, expect, it } from 'vitest';

import {
  createCrossDomainDetector,
} from '../src/cross-domain-detector.js';
import type {
  CorrelatedFeature,
  ExtractedFeatures,
  JoinScope,
  PropertySnapshot,
} from '../src/domain-contract.js';
import {
  PRIVACY_COOKIE_BEFORE_CONSENT,
  PRIVACY_TRACKER_BEFORE_CONSENT,
  RULE_CBF_COOKIE,
  RULE_CBF_REQUEST,
  RULE_DP_PRETICKED,
  RULE_NO_BANNER,
  privacyDomain,
} from '../src/domains/privacy.js';
import { createSharedWalker } from '../src/shared-walker.js';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/**
 * Build a minimal PropertySnapshot. All optional enrichment fields (cookies,
 * responseHeaders, tlsMeta, originArtifacts) may be set per test; they default
 * to empty so tests that do not need them stay concise.
 */
function makeSnap(
  overrides: Partial<PropertySnapshot> & Pick<PropertySnapshot, 'url'>,
): PropertySnapshot {
  return {
    scanId: 'privacy-test',
    timestamp: 0,
    html: '',
    headers: {},
    cookies: [],
    networkResources: [],
    axTree: [],
    domOutline: [],
    perfMetrics: {},
    timings: { navigationMs: 0, axTreeMs: 0, domMs: 0, totalMs: 0 },
    ...overrides,
  };
}

/**
 * Run the shared walker over a snapshot with the privacy domain registered and
 * return the features + the findings from evaluate().
 */
async function runPrivacy(snap: PropertySnapshot) {
  const result = await createSharedWalker({ snapshot: snap, domains: [privacyDomain] });
  const findings = privacyDomain.evaluate(result.features);
  return { features: result.features, findings };
}

// ---------------------------------------------------------------------------
// Extractor purity (synchronous, no I/O)
// ---------------------------------------------------------------------------

describe('Privacy extractor purity', () => {
  it('perDocument returns void, not a Promise', async () => {
    const snap = makeSnap({ url: 'http://pure.test/' });
    // Invoke perDocument directly — if it returned a Promise the value would
    // be an object; void/undefined confirms it is synchronous.
    let returnValue: unknown = 'unset';
    const mockAcc = {
      set: () => {},
      setScoped: () => {},
    };
    if (privacyDomain.extractors.perDocument) {
      returnValue = privacyDomain.extractors.perDocument(snap, mockAcc);
    }
    expect(returnValue).toBeUndefined();
  });

  it('perElement returns void, not a Promise', () => {
    const mockEl = {
      nodeName: 'DIV',
      selector: 'div.safe',
      attributes: {},
    };
    const mockAcc = {
      set: () => {},
      setScoped: () => {},
    };
    let returnValue: unknown = 'unset';
    if (privacyDomain.extractors.perElement) {
      returnValue = privacyDomain.extractors.perElement(mockEl, mockAcc);
    }
    expect(returnValue).toBeUndefined();
  });

  it('does not throw when cookies and networkResources are empty arrays', async () => {
    const snap = makeSnap({
      url: 'http://empty.test/',
      cookies: [],
      networkResources: [],
    });
    await expect(runPrivacy(snap)).resolves.not.toThrow();
  });

  it('does not throw when optional snapshot fields are absent', async () => {
    // PropertySnapshot.responseHeaders / tlsMeta / originArtifacts are optional.
    // The extractor must tolerate their absence without crashing.
    const snap = makeSnap({ url: 'http://absent-optionals.test/' });
    // No responseHeaders, tlsMeta, or originArtifacts set.
    await expect(runPrivacy(snap)).resolves.not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Positive case: cookies present, no banner → findings emitted
// ---------------------------------------------------------------------------

describe('Privacy positive cases (violations detected)', () => {
  it('emits a privacy-cbf-cookie finding for each cookie in the jar', async () => {
    const snap = makeSnap({
      url: 'http://violating.test/',
      cookies: [
        { name: '_ga', value: 'GA1.2.123.456' },
        { name: '_fbp', value: 'fb.1.0.999' },
      ],
      html: '<html><body><p>No banner here.</p></body></html>',
    });

    const { findings } = await runPrivacy(snap);

    const cbfFindings = findings.filter((f) => f.ruleId === RULE_CBF_COOKIE);
    // One finding per cookie in the jar.
    expect(cbfFindings).toHaveLength(2);
    expect(cbfFindings.map((f) => f.id)).toContain(`${RULE_CBF_COOKIE}-_ga`);
    expect(cbfFindings.map((f) => f.id)).toContain(`${RULE_CBF_COOKIE}-_fbp`);
    expect(cbfFindings[0]?.severity).toBe('serious');
    expect(cbfFindings[0]?.domain).toBe('privacy');
  });

  it('emits a privacy-cbf-cookie finding with GDPR regulatory mapping', async () => {
    const snap = makeSnap({
      url: 'http://reg-mapping.test/',
      cookies: [{ name: 'session_id', value: 'abc123' }],
      html: '<html><body></body></html>',
    });

    const { findings } = await runPrivacy(snap);
    const cbfFinding = findings.find((f) => f.ruleId === RULE_CBF_COOKIE);
    expect(cbfFinding).toBeDefined();
    expect(cbfFinding?.regulatoryMapping).toEqual(
      expect.arrayContaining([
        { framework: 'GDPR', code: 'Art. 7' },
        { framework: 'GDPR', code: 'Recital 32' },
      ]),
    );
  });

  it('emits a privacy-no-banner finding when cookies are present but no banner text', async () => {
    const snap = makeSnap({
      url: 'http://no-banner.test/',
      cookies: [{ name: '_ga', value: 'x' }],
      html: '<html><body><p>Hello world</p></body></html>',
    });

    const { findings } = await runPrivacy(snap);
    const noBanner = findings.find((f) => f.ruleId === RULE_NO_BANNER);
    expect(noBanner).toBeDefined();
    expect(noBanner?.severity).toBe('serious');
  });

  it('emits a privacy-cbf-request finding for a known tracker in networkResources', async () => {
    const snap = makeSnap({
      url: 'http://tracker-test.test/',
      cookies: [],
      networkResources: [
        { url: 'https://www.google-analytics.com/j/collect?v=1&t=pageview', status: 200 },
        { url: 'https://static.example.com/app.js', status: 200 },
      ],
      html: '<html><body></body></html>',
    });

    const { findings } = await runPrivacy(snap);
    const reqFinding = findings.find((f) => f.ruleId === RULE_CBF_REQUEST);
    expect(reqFinding).toBeDefined();
    expect(reqFinding?.severity).toBe('serious');
    expect(reqFinding?.message).toContain('google-analytics.com');
  });

  it('emits privacy-dp-preticked for a pre-checked accept INPUT in the DOM outline', async () => {
    const snap: PropertySnapshot = {
      ...makeSnap({ url: 'http://preticked.test/' }),
      domOutline: [
        {
          backendNodeId: 1,
          nodeName: 'INPUT',
          selector: '#accept-all',
          attributes: {
            type: 'checkbox',
            checked: '',
            'aria-label': 'Accept all cookies',
          },
        },
      ],
    };

    const { findings } = await runPrivacy(snap);
    const pretickedFinding = findings.find((f) => f.ruleId === RULE_DP_PRETICKED);
    expect(pretickedFinding).toBeDefined();
    expect(pretickedFinding?.severity).toBe('critical');
    expect(pretickedFinding?.element.selector).toBe('#accept-all');
  });
});

// ---------------------------------------------------------------------------
// Negative case: clean input → no finding (false-positive guard)
// ---------------------------------------------------------------------------

describe('Privacy negative cases (clean input → no findings)', () => {
  it('emits no findings when cookies is empty and no trackers are in networkResources', async () => {
    const snap = makeSnap({
      url: 'http://clean.test/',
      cookies: [],
      networkResources: [
        { url: 'https://static.clean-site.com/app.js', status: 200 },
        { url: 'https://fonts.googleapis.com/css2?family=Roboto', status: 200 },
      ],
      html: '<html><body><p>No tracking, no cookies.</p></body></html>',
    });

    // fonts.googleapis.com is a CDN endpoint; google-analytics.com is the tracker.
    // The module must distinguish them.
    const { findings } = await runPrivacy(snap);
    expect(findings).toHaveLength(0);
  });

  it('emits no findings for a page with no cookies and no network resources at all', async () => {
    const snap = makeSnap({
      url: 'http://minimal.test/',
    });
    const { findings } = await runPrivacy(snap);
    expect(findings).toHaveLength(0);
  });

  it('emits no privacy-no-banner finding when cookies are present alongside a consent banner', async () => {
    // Banner text is present in the HTML → the no-banner rule must NOT fire even
    // though there are cookies. The existence of a banner is a mitigating signal
    // (the cookie-before-consent rule still fires, but not the no-banner rule).
    const snap = makeSnap({
      url: 'http://has-banner.test/',
      cookies: [{ name: '_ga', value: 'x' }],
      html: '<html><body><div role="dialog" aria-label="Cookie consent">Accept cookies?</div></body></html>',
    });

    const { findings } = await runPrivacy(snap);
    const noBanner = findings.find((f) => f.ruleId === RULE_NO_BANNER);
    expect(noBanner).toBeUndefined();
  });

  it('emits no privacy-dp-preticked finding for a plain unchecked checkbox', async () => {
    const snap: PropertySnapshot = {
      ...makeSnap({ url: 'http://unchecked.test/' }),
      domOutline: [
        {
          backendNodeId: 1,
          nodeName: 'INPUT',
          selector: '#newsletter',
          attributes: { type: 'checkbox', 'aria-label': 'Accept marketing' },
          // Note: no 'checked' attribute present.
        },
      ],
    };

    const { findings } = await runPrivacy(snap);
    const pretickedFinding = findings.find((f) => f.ruleId === RULE_DP_PRETICKED);
    expect(pretickedFinding).toBeUndefined();
  });

  it('emits no privacy-cbf-request finding for non-tracking third-party URLs', async () => {
    const snap = makeSnap({
      url: 'http://safe-third-party.test/',
      cookies: [],
      networkResources: [
        { url: 'https://fonts.gstatic.com/s/roboto/v30/KFOm.woff2', status: 200 },
        { url: 'https://cdn.jsdelivr.net/npm/vue@3/dist/vue.global.js', status: 200 },
        { url: 'https://unpkg.com/react@18/umd/react.production.min.js', status: 200 },
      ],
    });

    const { findings } = await runPrivacy(snap);
    expect(findings.filter((f) => f.ruleId === RULE_CBF_REQUEST)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Interaction-feature case: cookie-scoped feature enables privacy↔security pair
// ---------------------------------------------------------------------------

describe('Privacy interaction features', () => {
  it('emits a cookie-scoped feature with joinScope=cookie and joinValue=cookieName', async () => {
    const snap = makeSnap({
      url: 'http://interaction.test/',
      cookies: [{ name: 'session_id', value: 'tok123' }],
    });

    const result = await createSharedWalker({ snapshot: snap, domains: [privacyDomain] });
    const cookieScope = result.features.byScope?.get('cookie');
    expect(cookieScope).toBeDefined();

    const sessionFeatures = cookieScope?.get('session_id');
    expect(sessionFeatures).toBeDefined();

    const privacyFeature = sessionFeatures?.find(
      (f: CorrelatedFeature) =>
        f.domainId === 'privacy' && f.featureKey === PRIVACY_COOKIE_BEFORE_CONSENT,
    );
    expect(privacyFeature).toBeDefined();
    expect(privacyFeature?.scope).toBe('cookie');
    expect(privacyFeature?.joinValue).toBe('session_id');
    expect(privacyFeature?.value).toBe(true);
  });

  it('cross-domain detector fires privacy↔security synergy when both domains flag the same cookie', () => {
    const detector = createCrossDomainDetector();

    // Synthetic feature set: privacy sees session_id before consent; security
    // sees session_id is missing the Secure flag. Both features on the same
    // cookie name → the detector should fire the seed pair.
    const features: ExtractedFeatures = {
      byElement: new Map(),
      byDocument: new Map(),
      byScope: new Map<JoinScope, Map<string, CorrelatedFeature[]>>([
        [
          'cookie',
          new Map([
            [
              'session_id',
              [
                {
                  domainId: 'privacy',
                  featureKey: PRIVACY_COOKIE_BEFORE_CONSENT,
                  value: true,
                  scope: 'cookie',
                  joinValue: 'session_id',
                },
                {
                  domainId: 'security',
                  featureKey: 'security:cookie-insecure-flags',
                  value: true,
                  scope: 'cookie',
                  joinValue: 'session_id',
                },
              ],
            ],
          ]),
        ],
      ]),
    };

    const records = detector.detect(features, 'scan-privacy-security-pair');
    const pairRecord = records.find(
      (r) => r.domains.includes('privacy') && r.domains.includes('security'),
    );
    expect(pairRecord).toBeDefined();
    expect(pairRecord?.type).toMatch(/^(conflict|synergy)$/);
    expect(pairRecord?.elementKey).toBe('session_id');
  });

  it('interactionFeatures declaration carries cookie joinScope for PRIVACY_COOKIE_BEFORE_CONSENT', () => {
    const spec = privacyDomain.interactionFeatures?.find(
      (s) => s.key === PRIVACY_COOKIE_BEFORE_CONSENT,
    );
    expect(spec).toBeDefined();
    expect(spec?.joinScope).toBe('cookie');
  });

  it('interactionFeatures declaration carries request joinScope for PRIVACY_TRACKER_BEFORE_CONSENT', () => {
    const spec = privacyDomain.interactionFeatures?.find(
      (s) => s.key === PRIVACY_TRACKER_BEFORE_CONSENT,
    );
    expect(spec).toBeDefined();
    expect(spec?.joinScope).toBe('request');
  });

  it('emits a request-scoped feature for each tracking origin found', async () => {
    const snap = makeSnap({
      url: 'http://tracker-scoped.test/',
      cookies: [],
      networkResources: [
        { url: 'https://www.google-analytics.com/collect', status: 200 },
      ],
    });

    const result = await createSharedWalker({ snapshot: snap, domains: [privacyDomain] });
    const requestScope = result.features.byScope?.get('request');
    expect(requestScope).toBeDefined();

    const gaFeatures = requestScope?.get('google-analytics.com');
    expect(gaFeatures).toBeDefined();
    const trackerFeature = gaFeatures?.find(
      (f: CorrelatedFeature) =>
        f.domainId === 'privacy' && f.featureKey === PRIVACY_TRACKER_BEFORE_CONSENT,
    );
    expect(trackerFeature).toBeDefined();
    expect(trackerFeature?.scope).toBe('request');
    expect(trackerFeature?.joinValue).toBe('google-analytics.com');
  });
});

// ---------------------------------------------------------------------------
// Domain metadata and contract shape
// ---------------------------------------------------------------------------

describe('Privacy domain metadata', () => {
  it('has the expected stable id', () => {
    expect(privacyDomain.id).toBe('privacy');
  });

  it('declares regulatory refs for GDPR', () => {
    expect(privacyDomain.regulatory).toBeDefined();
    expect(
      privacyDomain.regulatory?.some(
        (r) => r.framework === 'GDPR' && r.code.startsWith('Art.'),
      ),
    ).toBe(true);
  });

  it('declares at least two interactionFeatures', () => {
    expect(privacyDomain.interactionFeatures).toBeDefined();
    expect((privacyDomain.interactionFeatures?.length ?? 0)).toBeGreaterThanOrEqual(2);
  });

  it('adding privacy to an existing walker does not change traversal count', async () => {
    const snap: PropertySnapshot = {
      ...makeSnap({ url: 'http://traversal.test/' }),
      domOutline: [
        { backendNodeId: 1, nodeName: 'P', selector: 'p.hello' },
        { backendNodeId: 2, nodeName: 'DIV', selector: 'div.wrap' },
      ],
    };

    const result = await createSharedWalker({ snapshot: snap, domains: [privacyDomain] });
    expect(result.traversalCount).toBe(1);
  });
});
