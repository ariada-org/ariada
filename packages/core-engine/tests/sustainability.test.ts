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

import { describe, expect, it } from 'vitest';

import {
  SUSTAIN_LARGE_IMAGE,
  SUSTAIN_NO_LAZY_LOAD,
  sustainabilityDomain,
} from '../src/domains/sustainability.js';
import type {
  ExtractedFeatures,
  FeatureSink,
  PropertySnapshot,
} from '../src/domain-contract.js';

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
