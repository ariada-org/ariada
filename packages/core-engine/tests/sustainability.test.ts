// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Unit tests for the sustainability domain module.
//
// Invariants under test:
// - Extractors are pure and synchronous (no I/O, void return).
// - perElement sets element-scoped features on img/script elements only when
//   the relevant signal is present; clean elements produce no feature.
// - perDocument aggregates network resource data and stores document-level
//   features; absent networkResources yields zero values without throwing.
// - evaluate() turns features into findings that genuinely depend on the data:
//   a clean snapshot (within thresholds) produces no findings.
// - Interaction features are declared on the element scope so the cross-domain
//   detector can correlate them with accessibility domain features.
// - Fixture-coverage harness: loads the authored fixture corpus from
//   packages/ariada-test-fixtures/fixtures/domains/sustainability/ and asserts
//   every fail-* case is flagged at the stated severity, every pass-* is clean.

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import type {
  ExtractedFeatures,
  FeatureSink,
  PropertySnapshot,
} from '../src/domain-contract.js';
import {
  SUSTAIN_LARGE_IMAGE,
  SUSTAIN_NO_LAZY_LOAD,
  sustainabilityDomain,
} from '../src/domains/sustainability.js';
import { createSharedWalker } from '../src/shared-walker.js';

const __fixtureDir = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../ariada-test-fixtures/fixtures/domains/sustainability',
);

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/** Build a minimal PropertySnapshot for the perDocument extractor. */
function makeSnap(
  overrides: Partial<PropertySnapshot> = {},
): PropertySnapshot {
  return {
    scanId: 'test-scan',
    url: 'http://test.local/',
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
 * Lightweight FeatureSink that records set() calls so tests can assert
 * exactly which features the extractor emits. setScoped() is a no-op because
 * these domain extractors only use set().
 */
function makeSink(): FeatureSink & {
  elementEntries: Map<string, Map<string, unknown>>;
  docEntries: Map<string, unknown>;
} {
  const elementEntries = new Map<string, Map<string, unknown>>();
  const docEntries = new Map<string, unknown>();
  return {
    elementEntries,
    docEntries,
    set(elementKey: string, featureKey: string, value: unknown): void {
      if (elementKey === '') {
        docEntries.set(featureKey, value);
      } else {
        let bucket = elementEntries.get(elementKey);
        if (!bucket) {
          bucket = new Map();
          elementEntries.set(elementKey, bucket);
        }
        bucket.set(featureKey, value);
      }
    },
    setScoped() {
      // not used by sustainability extractors
    },
  };
}

/**
 * Build the ExtractedFeatures structure that evaluate() reads, mirroring what
 * the shared walker produces. Allows tests to inject arbitrary feature values
 * without running a full shared-walker pass.
 */
function makeFeatures(opts: {
  docOverrides?: Record<string, unknown>;
  elementMap?: Map<string, Record<string, unknown>>;
}): ExtractedFeatures {
  const byDocument = new Map<string, unknown>(
    Object.entries(opts.docOverrides ?? {}),
  );
  const byElement = new Map<string, { domainFeatures: Record<string, Map<string, unknown>> }>();
  for (const [selector, features] of (opts.elementMap ?? new Map())) {
    byElement.set(selector, {
      domainFeatures: {
        sustainability: new Map(Object.entries(features)),
      },
    });
  }
  return { byElement, byDocument };
}

// ---------------------------------------------------------------------------
// Extractor purity — synchronous, void return
// ---------------------------------------------------------------------------

describe('Extractor purity', () => {
  it('perElement returns undefined (synchronous, no Promise)', () => {
    const el = {
      nodeName: 'IMG',
      selector: 'img.test',
      attributes: { src: 'photo.jpg' },
    };
    const sink = makeSink();
    const result = sustainabilityDomain.extractors.perElement?.(el, sink);
    expect(result).toBeUndefined();
  });

  it('perDocument returns undefined (synchronous, no Promise)', () => {
    const snap = makeSnap();
    const sink = makeSink();
    const result = sustainabilityDomain.extractors.perDocument?.(snap, sink);
    expect(result).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// perElement — positive cases (feature is emitted)
// ---------------------------------------------------------------------------

describe('perElement — positive finding cases', () => {
  it('sets sustainability:large-image on an img with a non-next-gen src', () => {
    const el = {
      nodeName: 'IMG',
      selector: 'img.hero',
      attributes: { src: 'banner.jpg' },
    };
    const sink = makeSink();
    sustainabilityDomain.extractors.perElement?.(el, sink);

    expect(sink.elementEntries.get('img.hero')?.get(SUSTAIN_LARGE_IMAGE)).toBe(true);
  });

  it('sets sustainability:no-lazy-load on an img without a loading attribute', () => {
    const el = {
      nodeName: 'IMG',
      selector: 'img.below-fold',
      attributes: { src: 'photo.jpg' },
    };
    const sink = makeSink();
    sustainabilityDomain.extractors.perElement?.(el, sink);

    expect(sink.elementEntries.get('img.below-fold')?.get(SUSTAIN_NO_LAZY_LOAD)).toBe(true);
  });

  it('sets sustainability:third-party-script on a render-blocking external script', () => {
    const el = {
      nodeName: 'SCRIPT',
      selector: 'script.tracker',
      attributes: { src: 'https://third-party.example/tracker.js' },
    };
    const sink = makeSink();
    sustainabilityDomain.extractors.perElement?.(el, sink);

    expect(
      sink.elementEntries.get('script.tracker')?.get('sustainability:third-party-script'),
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// perElement — negative cases (clean input → no feature emitted)
// ---------------------------------------------------------------------------

describe('perElement — negative (clean input, no finding)', () => {
  it('does NOT set sustainability:large-image on an img with a .webp src', () => {
    const el = {
      nodeName: 'IMG',
      selector: 'img.optimised',
      attributes: { src: 'photo.webp', alt: 'optimised image', loading: 'lazy' },
    };
    const sink = makeSink();
    sustainabilityDomain.extractors.perElement?.(el, sink);

    expect(sink.elementEntries.get('img.optimised')?.get(SUSTAIN_LARGE_IMAGE)).toBeUndefined();
  });

  it('does NOT set sustainability:no-lazy-load on an img with loading="lazy"', () => {
    const el = {
      nodeName: 'IMG',
      selector: 'img.lazy',
      attributes: { src: 'photo.webp', loading: 'lazy' },
    };
    const sink = makeSink();
    sustainabilityDomain.extractors.perElement?.(el, sink);

    expect(sink.elementEntries.get('img.lazy')?.get(SUSTAIN_NO_LAZY_LOAD)).toBeUndefined();
  });

  it('does NOT emit any feature for a paragraph element', () => {
    const el = {
      nodeName: 'P',
      selector: 'p.text',
      attributes: {},
    };
    const sink = makeSink();
    sustainabilityDomain.extractors.perElement?.(el, sink);

    expect(sink.elementEntries.size).toBe(0);
  });

  it('does NOT set third-party-script on a deferred external script', () => {
    const el = {
      nodeName: 'SCRIPT',
      selector: 'script.deferred',
      attributes: { src: 'https://cdn.example/lib.js', defer: '' },
    };
    const sink = makeSink();
    sustainabilityDomain.extractors.perElement?.(el, sink);

    expect(
      sink.elementEntries.get('script.deferred')?.get('sustainability:third-party-script'),
    ).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// perDocument — positive finding cases
// ---------------------------------------------------------------------------

describe('perDocument — positive finding cases', () => {
  it('records total bytes from networkResources', () => {
    const snap = makeSnap({
      networkResources: [
        { url: 'http://test.local/a.js', mimeType: 'application/javascript', size: 500_000 },
        { url: 'http://test.local/b.css', mimeType: 'text/css', size: 200_000 },
      ],
    });
    const sink = makeSink();
    sustainabilityDomain.extractors.perDocument?.(snap, sink);

    expect(sink.docEntries.get('sustainability:total-bytes')).toBe(700_000);
  });

  it('counts third-party resources whose hostname differs from the page origin', () => {
    const snap = makeSnap({
      url: 'http://brand.com/',
      networkResources: [
        { url: 'http://brand.com/main.js', mimeType: 'application/javascript', size: 10_000 },
        { url: 'https://cdn.third-party.example/lib.js', mimeType: 'application/javascript', size: 50_000 },
        { url: 'https://analytics.external.com/track.js', mimeType: 'application/javascript', size: 5_000 },
      ],
    });
    const sink = makeSink();
    sustainabilityDomain.extractors.perDocument?.(snap, sink);

    expect(sink.docEntries.get('sustainability:third-party-count')).toBe(2);
  });

  it('counts unoptimized images (JPEG, PNG) and skips WebP/AVIF', () => {
    const snap = makeSnap({
      networkResources: [
        { url: 'http://test.local/hero.jpg', mimeType: 'image/jpeg', size: 300_000 },
        { url: 'http://test.local/icon.png', mimeType: 'image/png', size: 50_000 },
        { url: 'http://test.local/bg.webp', mimeType: 'image/webp', size: 20_000 },
        { url: 'http://test.local/logo.avif', mimeType: 'image/avif', size: 5_000 },
      ],
    });
    const sink = makeSink();
    sustainabilityDomain.extractors.perDocument?.(snap, sink);

    expect(sink.docEntries.get('sustainability:unoptimized-image-count')).toBe(2);
  });

  it('uses greenHosting=true from originArtifacts when present and lowers CO₂e estimate', () => {
    const bytes = 1_000_000;
    const snapGreen = makeSnap({
      networkResources: [{ url: 'http://test.local/a.js', size: bytes }],
      originArtifacts: { greenHosting: true },
    });
    const snapNonGreen = makeSnap({
      networkResources: [{ url: 'http://test.local/a.js', size: bytes }],
      // originArtifacts absent — defaults to greenHosting: false
    });

    const sinkGreen = makeSink();
    const sinkNonGreen = makeSink();
    sustainabilityDomain.extractors.perDocument?.(snapGreen, sinkGreen);
    sustainabilityDomain.extractors.perDocument?.(snapNonGreen, sinkNonGreen);

    const co2Green = sinkGreen.docEntries.get('sustainability:co2e-grams') as number;
    const co2NonGreen = sinkNonGreen.docEntries.get('sustainability:co2e-grams') as number;

    // Green hosting uses a lower grid intensity factor, so CO₂e must be lower.
    expect(co2Green).toBeLessThan(co2NonGreen);
    // Both must be positive for a non-zero byte count.
    expect(co2Green).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// perDocument — negative (clean input → within thresholds)
// ---------------------------------------------------------------------------

describe('perDocument — negative (clean input, no finding)', () => {
  it('records zero bytes and zero counts when networkResources is empty', () => {
    const snap = makeSnap({ networkResources: [] });
    const sink = makeSink();
    sustainabilityDomain.extractors.perDocument?.(snap, sink);

    expect(sink.docEntries.get('sustainability:total-bytes')).toBe(0);
    expect(sink.docEntries.get('sustainability:third-party-count')).toBe(0);
    expect(sink.docEntries.get('sustainability:unoptimized-image-count')).toBe(0);
  });

  it('tolerates absent originArtifacts without throwing', () => {
    const snap = makeSnap({ networkResources: [] });
    // originArtifacts is intentionally absent
    delete (snap as Partial<PropertySnapshot>).originArtifacts;
    const sink = makeSink();
    expect(() =>
      sustainabilityDomain.extractors.perDocument?.(snap, sink),
    ).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// evaluate() — positive finding cases (data-dependent findings)
// ---------------------------------------------------------------------------

describe('evaluate() — positive finding cases', () => {
  it('emits wsg-page-weight when total bytes exceed 1.5 MB', () => {
    const features = makeFeatures({
      docOverrides: {
        'sustainability:total-bytes': 2_000_000,
        'sustainability:third-party-count': 0,
        'sustainability:unoptimized-image-count': 0,
        'sustainability:co2e-grams': 0.37,
        'sustainability:carbon-rating': 'B',
      },
    });
    const findings = sustainabilityDomain.evaluate(features);
    expect(findings.some((f) => f.ruleId === 'wsg-page-weight')).toBe(true);
  });

  it('emits wsg-image-format when unoptimized image count is greater than zero', () => {
    const features = makeFeatures({
      docOverrides: {
        'sustainability:total-bytes': 500_000,
        'sustainability:third-party-count': 0,
        'sustainability:unoptimized-image-count': 3,
        'sustainability:co2e-grams': 0.09,
        'sustainability:carbon-rating': 'A+',
      },
    });
    const findings = sustainabilityDomain.evaluate(features);
    expect(findings.some((f) => f.ruleId === 'wsg-image-format')).toBe(true);
  });

  it('emits wsg-third-party-count when third-party count exceeds 5', () => {
    const features = makeFeatures({
      docOverrides: {
        'sustainability:total-bytes': 300_000,
        'sustainability:third-party-count': 8,
        'sustainability:unoptimized-image-count': 0,
        'sustainability:co2e-grams': 0.06,
        'sustainability:carbon-rating': 'A+',
      },
    });
    const findings = sustainabilityDomain.evaluate(features);
    expect(findings.some((f) => f.ruleId === 'wsg-third-party-count')).toBe(true);
  });

  it('emits wsg-carbon-rating for a rating of D or worse', () => {
    const features = makeFeatures({
      docOverrides: {
        'sustainability:total-bytes': 4_000_000,
        'sustainability:third-party-count': 0,
        'sustainability:unoptimized-image-count': 0,
        'sustainability:co2e-grams': 0.73,
        'sustainability:carbon-rating': 'D',
      },
    });
    const findings = sustainabilityDomain.evaluate(features);
    expect(findings.some((f) => f.ruleId === 'wsg-carbon-rating')).toBe(true);
  });

  it('emits wsg-lazy-load for an img element with sustainability:no-lazy-load set', () => {
    const features = makeFeatures({
      docOverrides: {
        'sustainability:total-bytes': 100_000,
        'sustainability:third-party-count': 0,
        'sustainability:unoptimized-image-count': 0,
        'sustainability:co2e-grams': 0.02,
        'sustainability:carbon-rating': 'A+',
      },
      elementMap: new Map([
        ['img.below-fold', { [SUSTAIN_NO_LAZY_LOAD]: true }],
      ]),
    });
    const findings = sustainabilityDomain.evaluate(features);
    const lazyFinding = findings.find((f) => f.ruleId === 'wsg-lazy-load');
    expect(lazyFinding).toBeDefined();
    expect(lazyFinding?.element.selector).toBe('img.below-fold');
  });
});

// ---------------------------------------------------------------------------
// evaluate() — negative (clean input → no findings)
// ---------------------------------------------------------------------------

describe('evaluate() — negative (clean snapshot, no findings)', () => {
  it('produces no findings when all metrics are within thresholds', () => {
    // Page well within the 1.5 MB limit, few third-party resources, no
    // unoptimized images, good carbon rating, no elements flagged for lazy load.
    const features = makeFeatures({
      docOverrides: {
        'sustainability:total-bytes': 300_000,
        'sustainability:third-party-count': 2,
        'sustainability:unoptimized-image-count': 0,
        'sustainability:co2e-grams': 0.055,
        'sustainability:carbon-rating': 'A+',
      },
    });
    const findings = sustainabilityDomain.evaluate(features);
    // No rule should fire for a page this clean.
    expect(findings).toHaveLength(0);
  });

  it('produces no lazy-load finding for an img element with no-lazy-load absent', () => {
    // Element entry exists but the no-lazy-load feature key is not set.
    const features = makeFeatures({
      docOverrides: {
        'sustainability:total-bytes': 200_000,
        'sustainability:third-party-count': 1,
        'sustainability:unoptimized-image-count': 0,
        'sustainability:co2e-grams': 0.037,
        'sustainability:carbon-rating': 'A+',
      },
      elementMap: new Map([
        // The element exists but has an unrelated feature set only.
        ['img.above-fold', { 'sustainability:large-image': true }],
      ]),
    });
    const findings = sustainabilityDomain.evaluate(features);
    expect(findings.every((f) => f.ruleId !== 'wsg-lazy-load')).toBe(true);
  });

  it('produces no wsg-carbon-rating finding for a page rated A+, A, B, or C', () => {
    for (const rating of ['A+', 'A', 'B', 'C'] as const) {
      const features = makeFeatures({
        docOverrides: {
          'sustainability:total-bytes': 100_000,
          'sustainability:third-party-count': 0,
          'sustainability:unoptimized-image-count': 0,
          'sustainability:co2e-grams': 0.02,
          'sustainability:carbon-rating': rating,
        },
      });
      const findings = sustainabilityDomain.evaluate(features);
      expect(
        findings.some((f) => f.ruleId === 'wsg-carbon-rating'),
        `Expected no carbon-rating finding for rating ${rating}`,
      ).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// Interaction feature declaration — element scope for cross-domain correlation
// ---------------------------------------------------------------------------

describe('interactionFeatures — element scope for cross-domain correlation', () => {
  it('declares interactionFeatures with joinScope "element"', () => {
    expect(sustainabilityDomain.interactionFeatures).toBeDefined();
    for (const spec of sustainabilityDomain.interactionFeatures ?? []) {
      expect(spec.joinScope).toBe('element');
    }
  });

  it('declares sustainability:large-image as an interaction feature key', () => {
    const keys = (sustainabilityDomain.interactionFeatures ?? []).map((s) => s.key);
    expect(keys).toContain(SUSTAIN_LARGE_IMAGE);
  });

  it('declares sustainability:no-lazy-load as an interaction feature key', () => {
    const keys = (sustainabilityDomain.interactionFeatures ?? []).map((s) => s.key);
    expect(keys).toContain(SUSTAIN_NO_LAZY_LOAD);
  });

  it('perElement emits sustainability:large-image on the element selector so the detector can correlate it with a11y:missing-alt on the same selector', () => {
    // Reproduce the seed pair: an img without next-gen format + without alt.
    // The accessibility domain records a11y:missing-alt on 'img.conflict'.
    // This domain records sustainability:large-image on the same selector.
    // The detector correlates them by shared selector (join value).
    const el = {
      nodeName: 'IMG',
      selector: 'img.conflict',
      attributes: { src: 'hero.jpg' }, // no alt, non-next-gen format
    };
    const sink = makeSink();
    sustainabilityDomain.extractors.perElement?.(el, sink);

    const features = sink.elementEntries.get('img.conflict');
    expect(features?.get(SUSTAIN_LARGE_IMAGE)).toBe(true);
    // The feature is keyed on 'img.conflict' — the same selector the
    // accessibility domain uses for a11y:missing-alt — so the detector
    // can find both in byElement['img.conflict'].domainFeatures.
  });
});

// ---------------------------------------------------------------------------
// Domain contract shape
// ---------------------------------------------------------------------------

describe('Domain contract shape', () => {
  it('has the correct id, title, and version', () => {
    expect(sustainabilityDomain.id).toBe('sustainability');
    expect(sustainabilityDomain.title).toBe('Sustainability');
    expect(sustainabilityDomain.version).toBe('0.1.0');
  });

  it('exposes both perElement and perDocument extractors', () => {
    expect(typeof sustainabilityDomain.extractors.perElement).toBe('function');
    expect(typeof sustainabilityDomain.extractors.perDocument).toBe('function');
  });

  it('exposes a non-empty regulatory array', () => {
    expect(sustainabilityDomain.regulatory?.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Fixture-coverage harness
// ---------------------------------------------------------------------------
// For each rule folder under fixtures/domains/sustainability/ we load the
// HTML and supply the harnessRequirement snapshot fields (networkResources,
// originArtifacts, snap.url) so the document-level rules can fire.  The
// element-level wsg-lazy-load rule uses a domOutline built from the known
// fixture markup.  No fixture files are edited.

/** Build a minimal PropertySnapshot for sustainability fixture tests. */
function makeFixtureSnap(
  html: string,
  overrides: Partial<PropertySnapshot> = {},
): PropertySnapshot {
  return {
    scanId: 'fixture-test',
    url: 'https://example.com/',
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

/** Run the sustainability domain with the shared walker and return findings by ruleId. */
async function runFixture(snap: PropertySnapshot): Promise<Map<string, ReturnType<typeof sustainabilityDomain.evaluate>>> {
  const walker = await createSharedWalker({ snapshot: snap, domains: [sustainabilityDomain] });
  const findings = sustainabilityDomain.evaluate(walker.features);
  const byRule = new Map<string, typeof findings>();
  for (const f of findings) {
    if (!byRule.has(f.ruleId)) byRule.set(f.ruleId, []);
    byRule.get(f.ruleId)!.push(f);
  }
  return byRule;
}

// ---- wsg-lazy-load ----

describe('wsg-lazy-load fixture corpus (WSG 2.18)', () => {
  const html = readFileSync(join(__fixtureDir, 'wsg-lazy-load/wsg-lazy-load.html'), 'utf8');

  // The perElement extractor reads domOutline entries.  We supply entries that
  // mirror the fixture HTML's <img> elements with their id-based selectors.
  const domOutline: PropertySnapshot['domOutline'] = [
    // fail-1: no loading attribute
    { backendNodeId: 1, nodeName: 'IMG', selector: '#fail-1', attributes: { src: 'hero-photo.jpg', alt: 'A scenic coastal landscape used as a page hero', width: '1200', height: '600' } },
    // fail-2: no loading attribute
    { backendNodeId: 2, nodeName: 'IMG', selector: '#fail-2', attributes: { src: '/images/product-shot', alt: 'Product photograph showing the device from the front', width: '800', height: '600' } },
    // pass-1: loading="lazy"
    { backendNodeId: 3, nodeName: 'IMG', selector: '#pass-1', attributes: { src: 'thumbnail.webp', alt: 'A small thumbnail of the article author', loading: 'lazy', width: '64', height: '64' } },
    // pass-2: loading="eager"
    { backendNodeId: 4, nodeName: 'IMG', selector: '#pass-2', attributes: { src: 'above-fold-logo.png', alt: 'Site logo displayed above the fold', loading: 'eager', width: '200', height: '80' } },
  ];

  it('fail-1: img with no loading attribute fires wsg-lazy-load at minor severity', async () => {
    const snap = makeFixtureSnap(html, { domOutline });
    const byRule = await runFixture(snap);
    const lazyFindings = byRule.get('wsg-lazy-load') ?? [];
    const fail1 = lazyFindings.find((f) => f.element.selector === '#fail-1');
    expect(fail1).toBeDefined();
    expect(fail1?.severity).toBe('minor');
  });

  it('fail-2: second img with no loading attribute fires wsg-lazy-load at minor severity', async () => {
    const snap = makeFixtureSnap(html, { domOutline });
    const byRule = await runFixture(snap);
    const lazyFindings = byRule.get('wsg-lazy-load') ?? [];
    const fail2 = lazyFindings.find((f) => f.element.selector === '#fail-2');
    expect(fail2).toBeDefined();
    expect(fail2?.severity).toBe('minor');
  });

  it('pass-1: img with loading="lazy" does not fire wsg-lazy-load', async () => {
    const snap = makeFixtureSnap(html, { domOutline });
    const byRule = await runFixture(snap);
    const lazyFindings = byRule.get('wsg-lazy-load') ?? [];
    const pass1 = lazyFindings.find((f) => f.element.selector === '#pass-1');
    expect(pass1).toBeUndefined();
  });

  it('pass-2: img with loading="eager" does not fire wsg-lazy-load', async () => {
    const snap = makeFixtureSnap(html, { domOutline });
    const byRule = await runFixture(snap);
    const lazyFindings = byRule.get('wsg-lazy-load') ?? [];
    const pass2 = lazyFindings.find((f) => f.element.selector === '#pass-2');
    expect(pass2).toBeUndefined();
  });
});

// ---- wsg-image-format ----

describe('wsg-image-format fixture corpus (WSG 2.14)', () => {
  const html = readFileSync(join(__fixtureDir, 'wsg-image-format/wsg-image-format.html'), 'utf8');

  it('fail-1: JPEG networkResources fire wsg-image-format at moderate severity', async () => {
    const snap = makeFixtureSnap(html, {
      networkResources: [
        { url: 'https://example.com/product-photo.jpg', mimeType: 'image/jpeg', size: 45000 },
        { url: 'https://example.com/team-photo.jpg', mimeType: 'image/jpeg', size: 120000 },
      ],
    });
    const byRule = await runFixture(snap);
    const findings = byRule.get('wsg-image-format') ?? [];
    expect(findings.length).toBeGreaterThanOrEqual(1);
    expect(findings[0]?.severity).toBe('moderate');
    expect(findings[0]?.element.selector).toBe(':root');
  });

  it('pass-1: WebP and AVIF networkResources do not fire wsg-image-format', async () => {
    const snap = makeFixtureSnap(html, {
      networkResources: [
        { url: 'https://example.com/product-photo.webp', mimeType: 'image/webp', size: 18000 },
        { url: 'https://example.com/team-photo.avif', mimeType: 'image/avif', size: 35000 },
      ],
    });
    const byRule = await runFixture(snap);
    expect(byRule.has('wsg-image-format')).toBe(false);
  });
});

// ---- wsg-page-weight ----

describe('wsg-page-weight fixture corpus (WSG 2.15)', () => {
  const html = readFileSync(join(__fixtureDir, 'wsg-page-weight/wsg-page-weight.html'), 'utf8');

  it('fail-1: 2,035,000-byte resources fire wsg-page-weight at serious severity', async () => {
    const snap = makeFixtureSnap(html, {
      networkResources: [
        { url: 'https://example.com/hero-full-res.jpg', mimeType: 'image/jpeg', size: 850000 },
        { url: 'https://example.com/gallery-1.jpg', mimeType: 'image/jpeg', size: 420000 },
        { url: 'https://example.com/gallery-2.jpg', mimeType: 'image/jpeg', size: 390000 },
        { url: 'https://example.com/vendor-bundle.js', mimeType: 'text/javascript', size: 280000 },
        { url: 'https://example.com/app-bundle.js', mimeType: 'text/javascript', size: 95000 },
      ],
    });
    const byRule = await runFixture(snap);
    const findings = byRule.get('wsg-page-weight') ?? [];
    expect(findings.length).toBeGreaterThanOrEqual(1);
    expect(findings[0]?.severity).toBe('serious');
    expect(findings[0]?.element.selector).toBe(':root');
  });

  it('pass-1: 95,000-byte resources do not fire wsg-page-weight', async () => {
    const snap = makeFixtureSnap(html, {
      networkResources: [
        { url: 'https://example.com/hero-optimised.webp', mimeType: 'image/webp', size: 60000 },
        { url: 'https://example.com/app-slim.js', mimeType: 'text/javascript', size: 35000 },
      ],
    });
    const byRule = await runFixture(snap);
    expect(byRule.has('wsg-page-weight')).toBe(false);
  });
});

// ---- wsg-carbon-rating ----

describe('wsg-carbon-rating fixture corpus (WSG 3.3)', () => {
  const html = readFileSync(join(__fixtureDir, 'wsg-carbon-rating/wsg-carbon-rating.html'), 'utf8');

  it('fail-1: 500,000-byte resources (non-green) produce rating F, wsg-carbon-rating at serious severity', async () => {
    // 500,000 * 0.000000414 * 442 = 91.494 g CO2e → rating F
    const snap = makeFixtureSnap(html, {
      originArtifacts: { greenHosting: false },
      networkResources: [
        { url: 'https://example.com/hero.jpg', mimeType: 'image/jpeg', size: 180000 },
        { url: 'https://example.com/feature.jpg', mimeType: 'image/jpeg', size: 130000 },
        { url: 'https://example.com/vendor.js', mimeType: 'text/javascript', size: 150000 },
        { url: 'https://example.com/app.js', mimeType: 'text/javascript', size: 40000 },
      ],
    });
    const byRule = await runFixture(snap);
    const findings = byRule.get('wsg-carbon-rating') ?? [];
    expect(findings.length).toBeGreaterThanOrEqual(1);
    expect(findings[0]?.severity).toBe('serious');
    expect(findings[0]?.element.selector).toBe(':root');
  });

  it('fail-2: 4,000-byte resources (non-green) produce rating E, wsg-carbon-rating at moderate severity', async () => {
    // 4,000 * 0.000000414 * 442 = 0.732 g CO2e → rating E (in [0.656, 1.0))
    const snap = makeFixtureSnap(html, {
      originArtifacts: { greenHosting: false },
      networkResources: [
        { url: 'https://example.com/icon.png', mimeType: 'image/png', size: 4000 },
      ],
    });
    const byRule = await runFixture(snap);
    const findings = byRule.get('wsg-carbon-rating') ?? [];
    expect(findings.length).toBeGreaterThanOrEqual(1);
    expect(findings[0]?.severity).toBe('moderate');
    expect(findings[0]?.element.selector).toBe(':root');
  });

  it('pass-1: empty networkResources produce rating A+, no wsg-carbon-rating finding', async () => {
    const snap = makeFixtureSnap(html, {
      originArtifacts: { greenHosting: false },
      networkResources: [],
    });
    const byRule = await runFixture(snap);
    expect(byRule.has('wsg-carbon-rating')).toBe(false);
  });
});

// ---- wsg-third-party-count ----

describe('wsg-third-party-count fixture corpus (WSG 2.17)', () => {
  const html = readFileSync(join(__fixtureDir, 'wsg-third-party-count/wsg-third-party-count.html'), 'utf8');

  it('fail-1: 6 third-party resources (> threshold 5) fire wsg-third-party-count at moderate severity', async () => {
    const snap = makeFixtureSnap(html, {
      url: 'https://example.com/',
      networkResources: [
        { url: 'https://example.com/main.js', mimeType: 'text/javascript', size: 45000 },
        { url: 'https://www.googletagmanager.com/gtag/js', mimeType: 'text/javascript', size: 28000 },
        { url: 'https://securepubads.g.doubleclick.net/tag/js/gpt.js', mimeType: 'text/javascript', size: 102000 },
        { url: 'https://connect.facebook.net/en_US/sdk.js', mimeType: 'text/javascript', size: 78000 },
        { url: 'https://widget.intercom.io/widget/abc123', mimeType: 'text/javascript', size: 55000 },
        { url: 'https://fonts.googleapis.com/css2?family=Inter', mimeType: 'text/css', size: 12000 },
        { url: 'https://cdn.hotjar.com/c/s/hotjar-123.js', mimeType: 'text/javascript', size: 33000 },
      ],
    });
    const byRule = await runFixture(snap);
    const findings = byRule.get('wsg-third-party-count') ?? [];
    expect(findings.length).toBeGreaterThanOrEqual(1);
    expect(findings[0]?.severity).toBe('moderate');
    expect(findings[0]?.element.selector).toBe(':root');
  });

  it('pass-1: 2 third-party resources (<= threshold 5) do not fire wsg-third-party-count', async () => {
    const snap = makeFixtureSnap(html, {
      url: 'https://example.com/',
      networkResources: [
        { url: 'https://example.com/main.js', mimeType: 'text/javascript', size: 45000 },
        { url: 'https://www.googletagmanager.com/gtag/js', mimeType: 'text/javascript', size: 28000 },
        { url: 'https://fonts.googleapis.com/css2?family=Roboto', mimeType: 'text/css', size: 9000 },
      ],
    });
    const byRule = await runFixture(snap);
    expect(byRule.has('wsg-third-party-count')).toBe(false);
  });
});

// ---- clean-page false-positive guard ----

describe('sustainability clean-page false-positive guard', () => {
  it('empty networkResources and no imgs produce no sustainability findings', async () => {
    const snap = makeFixtureSnap(
      '<!DOCTYPE html><html lang="en"><head><title>Clean</title></head><body><p>Hello</p></body></html>',
      { networkResources: [], domOutline: [] },
    );
    const walker = await createSharedWalker({ snapshot: snap, domains: [sustainabilityDomain] });
    const findings = sustainabilityDomain.evaluate(walker.features);
    expect(findings).toHaveLength(0);
  });

  it('single webp img with loading="lazy" and empty networkResources produces no findings', async () => {
    const snap = makeFixtureSnap(
      '<!DOCTYPE html><html><body><img src="hero.webp" alt="test" loading="lazy"></body></html>',
      {
        networkResources: [],
        domOutline: [
          { backendNodeId: 1, nodeName: 'IMG', selector: 'img', attributes: { src: 'hero.webp', alt: 'test', loading: 'lazy' } },
        ],
      },
    );
    const walker = await createSharedWalker({ snapshot: snap, domains: [sustainabilityDomain] });
    const findings = sustainabilityDomain.evaluate(walker.features);
    expect(findings).toHaveLength(0);
  });
});
