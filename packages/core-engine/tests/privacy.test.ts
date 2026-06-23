// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Fixture-coverage harness for the privacy domain module.
//
// Each describe block corresponds to one fixture rule from
// packages/ariada-test-fixtures/fixtures/domains/privacy/<rule>/.
// The expected.json oracle is the source of truth for fail/pass expectations.
//
// Privacy domain rules read snap.cookies, snap.networkResources, and
// snap.domOutline — not the HTML text alone. Each test case constructs a
// synthetic PropertySnapshot whose fields match what a capturing browser
// would record for the documented scenario.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

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

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_ROOT = join(
  __dirname,
  '../../ariada-test-fixtures/fixtures/domains/privacy',
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function loadFixtureHtml(ruleDir: string): string {
  return readFileSync(join(FIXTURES_ROOT, ruleDir, `${ruleDir}.html`), 'utf8');
}

/**
 * Build a minimal PropertySnapshot. The html field is loaded from the fixture
 * so the domain can run its perDocument HTML analysis. Additional snapshot
 * fields (cookies, networkResources, domOutline) are injected per-case to
 * simulate what a capturing browser would record before any consent interaction.
 */
function makeSnap(
  overrides: Partial<PropertySnapshot> & Pick<PropertySnapshot, 'url'>,
  html = '',
): PropertySnapshot {
  return {
    scanId: 'privacy-fixture-test',
    timestamp: 0,
    html,
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
 * Run the shared walker over a snapshot with the privacy domain registered
 * and return the findings for the specified rule.
 */
async function runPrivacy(snap: PropertySnapshot): Promise<ReturnType<typeof privacyDomain.evaluate>> {
  const result = await createSharedWalker({ snapshot: snap, domains: [privacyDomain] });
  return privacyDomain.evaluate(result.features);
}

async function findingsForRule(snap: PropertySnapshot, ruleId: string) {
  const all = await runPrivacy(snap);
  return all.filter((f) => f.ruleId === ruleId);
}

function hasRequestFindingForHost(findings: Awaited<ReturnType<typeof findingsForRule>>, host: string): boolean {
  return findings.some((f) => f.id === `${RULE_CBF_REQUEST}-${host}`);
}

// ---------------------------------------------------------------------------
// privacy-cbf-cookie
//
// Fires when snap.cookies is non-empty (cookies set before consent).
// fail-1: snap has a _ga cookie, no banner text in HTML.
// pass-1: snap has no cookies.
// ---------------------------------------------------------------------------

describe('privacy-cbf-cookie', () => {
  const html = loadFixtureHtml('privacy-cbf-cookie');

  it('fail-1: emits a finding when a cookie is present before consent', async () => {
    // The _ga cookie is set at DOMContentLoaded before any consent interaction.
    // A scanning browser records it in snap.cookies.
    const snap = makeSnap(
      {
        url: 'http://test.local/',
        cookies: [{ name: '_ga', value: 'GA1.1.123456789.1700000000' }],
      },
      html,
    );
    const findings = await findingsForRule(snap, RULE_CBF_COOKIE);
    expect(findings.length).toBeGreaterThanOrEqual(1);
    expect(findings[0]?.severity).toBe('serious');
    expect(findings[0]?.domain).toBe('privacy');
    expect(findings.some((f) => f.id === `${RULE_CBF_COOKIE}-_ga`)).toBe(true);
  });

  it('fail-1: finding has GDPR Art. 7 regulatory mapping', async () => {
    const snap = makeSnap(
      {
        url: 'http://test.local/',
        cookies: [{ name: '_ga', value: 'GA1.1.123456789.1700000000' }],
      },
      html,
    );
    const findings = await findingsForRule(snap, RULE_CBF_COOKIE);
    expect(findings.length).toBeGreaterThanOrEqual(1);
    expect(findings[0]?.regulatoryMapping?.some((r) => r.code === 'Art. 7')).toBe(true);
    expect(findings[0]?.regulatoryMapping?.some((r) => r.code === 'Recital 32')).toBe(true);
  });

  it('pass-1: emits no cbf-cookie finding when cookies is empty', async () => {
    // The pass case: no cookies in the jar — banner is present, cookies not yet set.
    const snap = makeSnap(
      { url: 'http://test.local/', cookies: [] },
      html,
    );
    const findings = await findingsForRule(snap, RULE_CBF_COOKIE);
    expect(findings).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// privacy-cbf-request
//
// Fires when snap.networkResources contains a request to a known tracking origin.
// fail-1: googletagmanager.com loaded before consent.
// fail-2: connect.facebook.net loaded before consent.
// pass-1: only first-party requests — no tracking origin.
// ---------------------------------------------------------------------------

describe('privacy-cbf-request', () => {
  const html = loadFixtureHtml('privacy-cbf-request');

  it('fail-1: emits a finding for googletagmanager.com in networkResources', async () => {
    // Google Tag Manager script loaded at DOMContentLoaded before consent.
    const snap = makeSnap(
      {
        url: 'http://test.local/',
        networkResources: [
          {
            url: 'https://www.googletagmanager.com/gtm.js?id=GTM-XXXX',
            status: 200,
            mimeType: 'application/javascript',
            size: 40000,
          },
        ],
      },
      html,
    );
    const findings = await findingsForRule(snap, RULE_CBF_REQUEST);
    expect(findings.length).toBeGreaterThanOrEqual(1);
    expect(findings[0]?.severity).toBe('serious');
    expect(hasRequestFindingForHost(findings, 'googletagmanager.com')).toBe(true);
  });

  it('fail-1: finding has GDPR Art. 7 regulatory mapping', async () => {
    const snap = makeSnap(
      {
        url: 'http://test.local/',
        networkResources: [
          { url: 'https://www.googletagmanager.com/gtm.js?id=GTM-XXXX', status: 200 },
        ],
      },
      html,
    );
    const findings = await findingsForRule(snap, RULE_CBF_REQUEST);
    expect(findings.length).toBeGreaterThanOrEqual(1);
    expect(findings[0]?.regulatoryMapping?.some((r) => r.code === 'Art. 7')).toBe(true);
  });

  it('fail-2: emits a finding for connect.facebook.net in networkResources', async () => {
    // Facebook Pixel SDK loaded before consent.
    const snap = makeSnap(
      {
        url: 'http://test.local/',
        networkResources: [
          {
            url: 'https://connect.facebook.net/en_US/fbevents.js',
            status: 200,
            mimeType: 'application/javascript',
            size: 70000,
          },
        ],
      },
      html,
    );
    const findings = await findingsForRule(snap, RULE_CBF_REQUEST);
    expect(findings.length).toBeGreaterThanOrEqual(1);
    expect(findings[0]?.severity).toBe('serious');
    expect(hasRequestFindingForHost(findings, 'connect.facebook.net')).toBe(true);
  });

  it('fail-1 and fail-2 combined: one finding per distinct tracking origin', async () => {
    // Both GTM and Facebook Pixel loaded before consent → two separate findings.
    const snap = makeSnap(
      {
        url: 'http://test.local/',
        networkResources: [
          { url: 'https://www.googletagmanager.com/gtm.js?id=GTM-XXXX', status: 200 },
          { url: 'https://connect.facebook.net/en_US/fbevents.js', status: 200 },
        ],
      },
      html,
    );
    const findings = await findingsForRule(snap, RULE_CBF_REQUEST);
    expect(findings.length).toBeGreaterThanOrEqual(2);
    expect(hasRequestFindingForHost(findings, 'googletagmanager.com')).toBe(true);
    expect(hasRequestFindingForHost(findings, 'connect.facebook.net')).toBe(true);
  });

  it('pass-1: emits no cbf-request finding for first-party resources only', async () => {
    // Only first-party requests — no known tracking origin.
    const snap = makeSnap(
      {
        url: 'http://test.local/',
        networkResources: [
          { url: 'https://example.com/analytics/collect', status: 200 },
          { url: 'https://example.com/fonts/sans.woff2', status: 200 },
        ],
      },
      html,
    );
    const findings = await findingsForRule(snap, RULE_CBF_REQUEST);
    expect(findings).toHaveLength(0);
  });

  it('pass-1: fonts.googleapis.com (CDN, not tracker) does not trigger the rule', async () => {
    // google-analytics.com is in TRACKING_ORIGINS; fonts.googleapis.com is not.
    const snap = makeSnap(
      {
        url: 'http://test.local/',
        networkResources: [
          { url: 'https://fonts.googleapis.com/css2?family=Roboto', status: 200 },
        ],
      },
      html,
    );
    const findings = await findingsForRule(snap, RULE_CBF_REQUEST);
    expect(findings).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// privacy-dp-preticked
//
// Fires when an INPUT[type=checkbox|radio] has the `checked` attribute (pre-ticked)
// AND its name/aria-label/value/title matches ACCEPT_PATTERN.
// fail-1: INPUT[type=checkbox][name="accept"][checked]
// fail-2: INPUT[type=radio][aria-label="Accept all"][checked]
// pass-1: INPUT[type=checkbox][name="accept"] — no `checked` attribute.
// pass-2: INPUT[type=checkbox][name="newsletter"][checked] — not accept-like.
// ---------------------------------------------------------------------------

describe('privacy-dp-preticked', () => {
  const html = loadFixtureHtml('privacy-dp-preticked');

  it('fail-1: emits a critical finding for pre-ticked checkbox with name="accept"', async () => {
    // INPUT[type=checkbox][checked][name="accept"] inside a cookie consent banner.
    const snap = makeSnap(
      {
        url: 'http://test.local/',
        domOutline: [
          {
            backendNodeId: 1,
            nodeName: 'INPUT',
            selector: '#fail-1 input[name="accept"]',
            attributes: { type: 'checkbox', name: 'accept', checked: '' },
          },
        ],
      },
      html,
    );
    const findings = await findingsForRule(snap, RULE_DP_PRETICKED);
    expect(findings.length).toBeGreaterThanOrEqual(1);
    expect(findings[0]?.severity).toBe('critical');
    expect(findings[0]?.domain).toBe('privacy');
  });

  it('fail-1: finding has GDPR Art. 4(11) and Art. 7 regulatory mapping', async () => {
    const snap = makeSnap(
      {
        url: 'http://test.local/',
        domOutline: [
          {
            backendNodeId: 1,
            nodeName: 'INPUT',
            selector: '#fail-1 input',
            attributes: { type: 'checkbox', name: 'accept', checked: '' },
          },
        ],
      },
      html,
    );
    const findings = await findingsForRule(snap, RULE_DP_PRETICKED);
    expect(findings.length).toBeGreaterThanOrEqual(1);
    expect(findings[0]?.regulatoryMapping?.some((r) => r.code === 'Art. 4(11)')).toBe(true);
    expect(findings[0]?.regulatoryMapping?.some((r) => r.code === 'Art. 7')).toBe(true);
  });

  it('fail-2: emits a critical finding for pre-selected radio with aria-label="Accept all"', async () => {
    // INPUT[type=radio][checked][aria-label="Accept all"] inside a consent banner.
    const snap = makeSnap(
      {
        url: 'http://test.local/',
        domOutline: [
          {
            backendNodeId: 2,
            nodeName: 'INPUT',
            selector: '#fail-2 input[aria-label="Accept all"]',
            attributes: {
              type: 'radio',
              name: 'cookie-choice',
              value: 'all',
              'aria-label': 'Accept all',
              checked: '',
            },
          },
        ],
      },
      html,
    );
    const findings = await findingsForRule(snap, RULE_DP_PRETICKED);
    expect(findings.length).toBeGreaterThanOrEqual(1);
    expect(findings[0]?.severity).toBe('critical');
  });

  it('pass-1: emits no finding for an accept checkbox without the checked attribute', async () => {
    // INPUT[type=checkbox][name="accept"] — not pre-ticked. isPretickedInput → false.
    const snap = makeSnap(
      {
        url: 'http://test.local/',
        domOutline: [
          {
            backendNodeId: 3,
            nodeName: 'INPUT',
            selector: '#pass-1 input',
            // No `checked` key in attributes.
            attributes: { type: 'checkbox', name: 'accept' },
          },
        ],
      },
      html,
    );
    const findings = await findingsForRule(snap, RULE_DP_PRETICKED);
    expect(findings).toHaveLength(0);
  });

  it('pass-2: emits no finding for a pre-ticked newsletter checkbox (not accept-like)', async () => {
    // INPUT[type=checkbox][checked][name="newsletter"] — isPretickedInput → true,
    // but isAcceptLikeControl → false because "newsletter" ∉ ACCEPT_PATTERN.
    const snap = makeSnap(
      {
        url: 'http://test.local/',
        domOutline: [
          {
            backendNodeId: 4,
            nodeName: 'INPUT',
            selector: '#pass-2 input',
            attributes: { type: 'checkbox', name: 'newsletter', checked: '' },
          },
        ],
      },
      html,
    );
    const findings = await findingsForRule(snap, RULE_DP_PRETICKED);
    expect(findings).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// privacy-no-banner
//
// Fires when snap.cookies is non-empty (hasPreconsent=true) AND the HTML has
// no text matching /cookie|consent|gdpr|privacy|accept|einwilligung/i.
//
// fail-1: _ga cookie set, HTML has no banner text at all.
// pass-1: cookie present but HTML contains "Cookie Preferences" → hasBannerText=true.
// pass-2: no cookies in snap.cookies → hasPreconsent=false, no finding.
// ---------------------------------------------------------------------------

describe('privacy-no-banner', () => {
  const html = loadFixtureHtml('privacy-no-banner');

  it('fail-1: emits a serious finding when cookies are set with no banner text', async () => {
    // The page sets _ga at load time and has no consent-related words in the HTML.
    // Construct a minimal HTML that matches the fail-1 scenario (no banner text).
    const failHtml =
      '<!DOCTYPE html><html lang="en"><head><title>Marketing page</title></head>' +
      '<body><h1>Welcome</h1><p>Browse our products.</p></body></html>';
    const snap = makeSnap(
      {
        url: 'http://test.local/',
        cookies: [{ name: '_ga', value: 'GA1.1.888.1700000000' }],
      },
      failHtml,
    );
    const findings = await findingsForRule(snap, RULE_NO_BANNER);
    expect(findings.length).toBeGreaterThanOrEqual(1);
    expect(findings[0]?.severity).toBe('serious');
    expect(findings[0]?.domain).toBe('privacy');
  });

  it('fail-1: finding has GDPR Art. 7 regulatory mapping', async () => {
    const failHtml = '<html><body><p>Hello world.</p></body></html>';
    const snap = makeSnap(
      {
        url: 'http://test.local/',
        cookies: [{ name: '_ga', value: 'GA1.1.888.1700000000' }],
      },
      failHtml,
    );
    const findings = await findingsForRule(snap, RULE_NO_BANNER);
    expect(findings.length).toBeGreaterThanOrEqual(1);
    expect(findings[0]?.regulatoryMapping?.some((r) => r.code === 'Art. 7')).toBe(true);
  });

  it('pass-1: no no-banner finding when cookies present alongside banner text in HTML', async () => {
    // The word "Cookie" in the HTML → BANNER_TEXT_PATTERN matches → hasBannerText=true.
    // privacy-no-banner does NOT fire even though cookies are present.
    const passHtml =
      '<html><body>' +
      '<div role="dialog" aria-label="Cookie consent">' +
      '<h3>Cookie Preferences</h3><p>We use cookies.</p>' +
      '<button>Accept all</button></div>' +
      '</body></html>';
    const snap = makeSnap(
      {
        url: 'http://test.local/',
        cookies: [{ name: '_session', value: 'abc123' }],
      },
      passHtml,
    );
    const findings = await findingsForRule(snap, RULE_NO_BANNER);
    expect(findings).toHaveLength(0);
  });

  it('pass-2: no finding when snap.cookies is empty regardless of HTML content', async () => {
    // hasPreconsent=false → the compound condition is never satisfied.
    const snap = makeSnap(
      { url: 'http://test.local/', cookies: [] },
      html,
    );
    const findings = await findingsForRule(snap, RULE_NO_BANNER);
    expect(findings).toHaveLength(0);
  });

  it('alsoExpect: privacy-cbf-cookie fires on the same fail-1 scenario', async () => {
    // The expected.json alsoExpect includes privacy-cbf-cookie, confirming that
    // when a cookie is present, both rules fire simultaneously.
    const failHtml = '<html><body><p>Hello world.</p></body></html>';
    const snap = makeSnap(
      {
        url: 'http://test.local/',
        cookies: [{ name: '_ga', value: 'GA1.1.888.1700000000' }],
      },
      failHtml,
    );
    const all = await runPrivacy(snap);
    expect(all.some((f) => f.ruleId === RULE_NO_BANNER)).toBe(true);
    expect(all.some((f) => f.ruleId === RULE_CBF_COOKIE)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Extractor purity (synchronous, no I/O)
// ---------------------------------------------------------------------------

describe('Privacy extractor purity', () => {
  it('perDocument returns void, not a Promise', () => {
    const snap = makeSnap({ url: 'http://pure.test/' });
    let returnValue: unknown = 'unset';
    const mockAcc = { set: () => {}, setScoped: () => {} };
    if (privacyDomain.extractors.perDocument) {
      returnValue = privacyDomain.extractors.perDocument(snap, mockAcc);
    }
    expect(returnValue).toBeUndefined();
  });

  it('perElement returns void, not a Promise', () => {
    const mockEl = { nodeName: 'DIV', selector: 'div.safe', attributes: {} };
    const mockAcc = { set: () => {}, setScoped: () => {} };
    let returnValue: unknown = 'unset';
    if (privacyDomain.extractors.perElement) {
      returnValue = privacyDomain.extractors.perElement(mockEl, mockAcc);
    }
    expect(returnValue).toBeUndefined();
  });

  it('does not throw when cookies and networkResources are empty arrays', async () => {
    const snap = makeSnap({ url: 'http://empty.test/', cookies: [], networkResources: [] });
    await expect(
      createSharedWalker({ snapshot: snap, domains: [privacyDomain] })
        .then((r) => privacyDomain.evaluate(r.features)),
    ).resolves.not.toThrow();
  });

  it('does not throw when optional snapshot fields are absent', async () => {
    const snap = makeSnap({ url: 'http://absent-optionals.test/' });
    await expect(
      createSharedWalker({ snapshot: snap, domains: [privacyDomain] })
        .then((r) => privacyDomain.evaluate(r.features)),
    ).resolves.not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Clean-page false-positive guard — no privacy findings on a minimal page
// ---------------------------------------------------------------------------

describe('Privacy clean-page guard (false-positive prevention)', () => {
  it('empty cookies + empty networkResources + no banner text → zero privacy findings', async () => {
    const snap = makeSnap(
      {
        url: 'http://clean.test/',
        cookies: [],
        networkResources: [],
        domOutline: [],
      },
      '<!DOCTYPE html><html lang="en"><head><title>Clean</title></head><body><p>Hello</p></body></html>',
    );
    const findings = await runPrivacy(snap);
    expect(findings).toHaveLength(0);
  });

  it('a non-tracking CDN resource does not trigger cbf-request', async () => {
    const snap = makeSnap(
      {
        url: 'http://clean.test/',
        networkResources: [
          { url: 'https://fonts.gstatic.com/s/roboto/v30/KFOm.woff2', status: 200 },
          { url: 'https://cdn.jsdelivr.net/npm/vue@3/dist/vue.global.js', status: 200 },
        ],
      },
      '<html><body></body></html>',
    );
    const findings = await runPrivacy(snap);
    expect(findings.filter((f) => f.ruleId === RULE_CBF_REQUEST)).toHaveLength(0);
  });

  it('a plain unchecked checkbox does not trigger dp-preticked', async () => {
    const snap = makeSnap(
      {
        url: 'http://clean.test/',
        domOutline: [
          {
            backendNodeId: 1,
            nodeName: 'INPUT',
            selector: '#newsletter',
            attributes: { type: 'checkbox', 'aria-label': 'Subscribe to newsletter' },
            // No `checked` attribute.
          },
        ],
      },
      '<html><body><input type="checkbox" id="newsletter"></body></html>',
    );
    const findings = await runPrivacy(snap);
    expect(findings.filter((f) => f.ruleId === RULE_DP_PRETICKED)).toHaveLength(0);
  });

  it('cookies present + banner text present → no-banner does not fire', async () => {
    const snap = makeSnap(
      {
        url: 'http://clean-with-banner.test/',
        cookies: [{ name: '_ga', value: 'x' }],
      },
      '<html><body><div role="dialog">Cookie consent banner here</div></body></html>',
    );
    const findings = await runPrivacy(snap);
    expect(findings.filter((f) => f.ruleId === RULE_NO_BANNER)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Interaction features
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

  it('emits a request-scoped feature for each tracking origin found', async () => {
    const snap = makeSnap({
      url: 'http://tracker-scoped.test/',
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

  it('cross-domain detector fires privacy↔security synergy when both domains flag the same cookie', () => {
    const detector = createCrossDomainDetector();
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
});

// ---------------------------------------------------------------------------
// Domain module contract conformance
// ---------------------------------------------------------------------------

describe('Privacy DomainModule contract conformance', () => {
  it('has required fields: id, title, version, extractors, evaluate', () => {
    expect(privacyDomain.id).toBe('privacy');
    expect(typeof privacyDomain.title).toBe('string');
    expect(typeof privacyDomain.version).toBe('string');
    expect(typeof privacyDomain.extractors).toBe('object');
    expect(typeof privacyDomain.evaluate).toBe('function');
  });

  it('declares GDPR regulatory refs', () => {
    expect(privacyDomain.regulatory).toBeDefined();
    expect(
      privacyDomain.regulatory?.some((r) => r.framework === 'GDPR' && r.code.startsWith('Art.')),
    ).toBe(true);
  });

  it('declares at least two interactionFeatures', () => {
    expect(privacyDomain.interactionFeatures).toBeDefined();
    expect((privacyDomain.interactionFeatures?.length ?? 0)).toBeGreaterThanOrEqual(2);
  });

  it('evaluate is deterministic: same features produce same findings', async () => {
    const snap = makeSnap(
      {
        url: 'http://determinism.test/',
        cookies: [{ name: '_ga', value: 'x' }],
        networkResources: [
          { url: 'https://www.google-analytics.com/collect', status: 200 },
        ],
      },
      '<html><body><p>Hello</p></body></html>',
    );
    const walker1 = await createSharedWalker({ snapshot: snap, domains: [privacyDomain] });
    const walker2 = await createSharedWalker({ snapshot: snap, domains: [privacyDomain] });
    const findings1 = privacyDomain.evaluate(walker1.features);
    const findings2 = privacyDomain.evaluate(walker2.features);
    expect(findings1.map((f) => f.id).sort()).toEqual(findings2.map((f) => f.id).sort());
  });

  it('every finding has a non-empty regulatoryMapping', async () => {
    const snap = makeSnap(
      {
        url: 'http://reg-mapping.test/',
        cookies: [{ name: '_ga', value: 'x' }],
        networkResources: [
          { url: 'https://www.google-analytics.com/collect', status: 200 },
        ],
        domOutline: [
          {
            backendNodeId: 1,
            nodeName: 'INPUT',
            selector: '#accept',
            attributes: { type: 'checkbox', name: 'accept', checked: '' },
          },
        ],
      },
      '<html><body><p>Hello</p></body></html>',
    );
    const all = await runPrivacy(snap);
    expect(all.length).toBeGreaterThan(0);
    for (const f of all) {
      expect(
        (f.regulatoryMapping ?? []).length,
        `finding ${f.id} must have regulatoryMapping`,
      ).toBeGreaterThan(0);
    }
  });

  it('adding privacy domain does not change traversal count (shared walker)', async () => {
    const snap = makeSnap(
      {
        url: 'http://traversal.test/',
        domOutline: [
          { backendNodeId: 1, nodeName: 'P', selector: 'p.hello' },
          { backendNodeId: 2, nodeName: 'DIV', selector: 'div.wrap' },
        ],
      },
    );
    const result = await createSharedWalker({ snapshot: snap, domains: [privacyDomain] });
    expect(result.traversalCount).toBe(1);
  });
});
