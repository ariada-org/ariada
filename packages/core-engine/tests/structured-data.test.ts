// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Tests for the structured-data domain module.
//
// Four categories:
//   1. Extractor purity — perElement and perDocument are synchronous, return
//      void, and do not mutate the snapshot they receive.
//   2. Positive finding cases — rule engine produces the expected Finding when
//      the input data meets the violation condition.
//   3. Negative finding cases — rule engine produces no Finding on clean input
//      (false-positive invariant: a clean page produces no findings).
//   4. Interaction-feature case — the domain emits the element-scoped SD_IMAGE_ANCHOR
//      feature on IMG elements so the cross-domain detector can join it with the
//      accessibility domain's missing-alt feature on the same selector.

import { describe, expect, it } from 'vitest';

import {
  RULE_ARTICLE_REQUIRED,
  RULE_IMAGE_OBJECT_DESCRIPTION,
  RULE_PARSE_ERROR,
  RULE_PRICE_VALIDITY,
  RULE_PRODUCT_REQUIRED,
  SD_IMAGE_ANCHOR,
  SD_SCHEMA_BLOCKS,
  structuredDataDomain,
} from '../src/domains/structured-data.js';
import type {
  DomainModule,
  ElementHandle,
  ExtractedFeatures,
  FeatureSink,
  PropertySnapshot,
} from '../src/domain-contract.js';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/**
 * Build a minimal PropertySnapshot with controlled HTML. Optional cookies,
 * responseHeaders, tlsMeta, and originArtifacts are intentionally omitted to
 * confirm the module tolerates absent optional snapshot fields.
 */
function makeSnapshot(html: string, url = 'http://test.local/'): PropertySnapshot {
  return {
    scanId: 'scan-sd-test',
    url,
    timestamp: 0,
    html,
    headers: {},
    cookies: [],
    networkResources: [],
    axTree: [],
    domOutline: [],
    perfMetrics: {},
    timings: { navigationMs: 0, axTreeMs: 0, domMs: 0, totalMs: 0 },
    // responseHeaders, tlsMeta, originArtifacts intentionally absent
  };
}

/** An HTML page that contains no JSON-LD blocks at all. */
const HTML_EMPTY = '<html><body><p>No structured data.</p></body></html>';

/** A valid Product JSON-LD block with all required fields including a future priceValidUntil. */
const HTML_PRODUCT_COMPLETE = `
<html><head>
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "Widget Pro",
  "image": "https://example.com/widget.jpg",
  "description": "A high-quality widget",
  "offers": {
    "@type": "Offer",
    "price": "29.99",
    "priceCurrency": "USD",
    "priceValidUntil": "2099-12-31",
    "availability": "https://schema.org/InStock"
  }
}
</script>
</head><body></body></html>`;

/** A Product JSON-LD block missing the required "name" field. */
const HTML_PRODUCT_MISSING_NAME = `
<html><head>
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Product",
  "image": "https://example.com/widget.jpg",
  "description": "A widget",
  "offers": {
    "price": "9.99",
    "priceCurrency": "EUR",
    "priceValidUntil": "2099-01-01"
  }
}
</script>
</head><body></body></html>`;

/** A Product where the Offer has no priceValidUntil. */
const HTML_PRODUCT_NO_PRICE_VALIDITY = `
<html><head>
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "Gadget",
  "image": "https://example.com/gadget.jpg",
  "description": "A gadget",
  "offers": {
    "price": "49.99",
    "priceCurrency": "USD"
  }
}
</script>
</head><body></body></html>`;

/** A Product where the Offer's priceValidUntil date is in the past. */
const HTML_PRODUCT_PAST_PRICE_VALIDITY = `
<html><head>
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "Legacy Item",
  "image": "https://example.com/legacy.jpg",
  "description": "A legacy item",
  "offers": {
    "price": "5.00",
    "priceCurrency": "USD",
    "priceValidUntil": "2000-01-01"
  }
}
</script>
</head><body></body></html>`;

/** A syntactically invalid JSON-LD block. */
const HTML_INVALID_JSON_LD = `
<html><head>
<script type="application/ld+json">
{ this is not valid json !!!
</script>
</head><body></body></html>`;

/** An ImageObject block without a description property. */
const HTML_IMAGE_OBJECT_NO_DESCRIPTION = `
<html><head>
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "ImageObject",
  "contentUrl": "https://example.com/photo.jpg",
  "width": 800,
  "height": 600
}
</script>
</head><body></body></html>`;

/** An ImageObject block with a description property — no finding expected. */
const HTML_IMAGE_OBJECT_WITH_DESCRIPTION = `
<html><head>
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "ImageObject",
  "contentUrl": "https://example.com/photo.jpg",
  "description": "A photo of a landscape at sunrise",
  "width": 800,
  "height": 600
}
</script>
</head><body></body></html>`;

/** A complete Article JSON-LD block with all required fields. */
const HTML_ARTICLE_COMPLETE = `
<html><head>
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "My Article",
  "datePublished": "2026-01-15",
  "image": "https://example.com/article.jpg",
  "author": { "@type": "Person", "name": "Alex Smith" }
}
</script>
</head><body></body></html>`;

/** An Article JSON-LD block missing the author.name field. */
const HTML_ARTICLE_MISSING_AUTHOR_NAME = `
<html><head>
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "My Article",
  "datePublished": "2026-01-15",
  "image": "https://example.com/article.jpg",
  "author": { "@type": "Person" }
}
</script>
</head><body></body></html>`;

/**
 * Simulate the shared walker's perDocument call: run the domain's perDocument
 * extractor with a controlled sink and return the features it emitted.
 */
function runPerDocument(
  domain: DomainModule,
  snap: PropertySnapshot,
): ExtractedFeatures {
  const features: ExtractedFeatures = {
    byElement: new Map(),
    byDocument: new Map(),
  };

  const sink: FeatureSink = {
    set(elementKey: string, featureKey: string, value: unknown): void {
      const key = elementKey ? `${elementKey}::${featureKey}` : featureKey;
      features.byDocument.set(key, value);
    },
    setScoped() {
      // Not used by this domain's extractors.
    },
  };

  domain.extractors.perDocument?.(snap, sink);
  return features;
}

/**
 * Simulate the shared walker's perElement call for a single element. Returns
 * the features the domain wrote into byElement.
 */
function runPerElement(
  domain: DomainModule,
  el: ElementHandle,
): ExtractedFeatures {
  const features: ExtractedFeatures = {
    byElement: new Map(),
    byDocument: new Map(),
  };

  const sink: FeatureSink = {
    set(elementKey: string, featureKey: string, value: unknown): void {
      let bucket = features.byElement.get(elementKey);
      if (!bucket) {
        bucket = { domainFeatures: {} };
        features.byElement.set(elementKey, bucket);
      }
      let domainMap = bucket.domainFeatures['structured-data'];
      if (!domainMap) {
        domainMap = new Map();
        bucket.domainFeatures['structured-data'] = domainMap;
      }
      domainMap.set(featureKey, value);
    },
    setScoped() {},
  };

  domain.extractors.perElement?.(el, sink);
  return features;
}

/**
 * Build ExtractedFeatures populated from perDocument alone. The evaluate()
 * method reads from byDocument to get the schema blocks stored during the pass.
 */
function featuresFromHtml(domain: DomainModule, html: string): ExtractedFeatures {
  return runPerDocument(domain, makeSnapshot(html));
}

// ---------------------------------------------------------------------------
// 1. Extractor purity
// ---------------------------------------------------------------------------

describe('Structured-data extractor purity', () => {
  it('perElement returns void (synchronous, no Promise returned)', () => {
    const el: ElementHandle = { nodeName: 'IMG', selector: 'img.hero' };
    const sink: FeatureSink = { set() {}, setScoped() {} };

    const returnValue = structuredDataDomain.extractors.perElement?.(el, sink);

    // A void return is undefined; a Promise return would be an object.
    expect(returnValue).toBeUndefined();
  });

  it('perDocument returns void (synchronous, no Promise returned)', () => {
    const snap = makeSnapshot(HTML_EMPTY);
    const sink: FeatureSink = { set() {}, setScoped() {} };

    const returnValue = structuredDataDomain.extractors.perDocument?.(snap, sink);

    expect(returnValue).toBeUndefined();
  });

  it('perDocument does not mutate the snapshot it receives', () => {
    const snap = makeSnapshot(HTML_PRODUCT_COMPLETE);
    const originalHtml = snap.html;
    const originalUrl = snap.url;
    const sink: FeatureSink = { set() {}, setScoped() {} };

    structuredDataDomain.extractors.perDocument?.(snap, sink);

    expect(snap.html).toBe(originalHtml);
    expect(snap.url).toBe(originalUrl);
    expect(snap.cookies).toHaveLength(0);
  });

  it('perElement does not mutate the element it receives', () => {
    const el: ElementHandle = {
      nodeName: 'IMG',
      selector: 'img.logo',
      attributes: { src: 'logo.png' },
    };
    const originalNodeName = el.nodeName;
    const originalSelector = el.selector;
    const sink: FeatureSink = { set() {}, setScoped() {} };

    structuredDataDomain.extractors.perElement?.(el, sink);

    expect(el.nodeName).toBe(originalNodeName);
    expect(el.selector).toBe(originalSelector);
  });

  it('perDocument tolerates a snapshot with absent optional fields (no cookies, no responseHeaders)', () => {
    // The base PropertySnapshot always has cookies: [] and networkResources: []
    // but optional fields like responseHeaders, tlsMeta, originArtifacts may be
    // absent on a plain capture.
    const snap = makeSnapshot(HTML_EMPTY);
    // Confirm optional enrichment fields are absent.
    expect(snap.responseHeaders).toBeUndefined();
    expect(snap.tlsMeta).toBeUndefined();
    expect(snap.originArtifacts).toBeUndefined();

    let threw = false;
    try {
      const sink: FeatureSink = { set() {}, setScoped() {} };
      structuredDataDomain.extractors.perDocument?.(snap, sink);
    } catch {
      threw = true;
    }
    expect(threw).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 2. Positive finding cases
// ---------------------------------------------------------------------------

describe('Structured-data rule engine — positive findings (violations)', () => {
  it('emits sd-parse-error when a JSON-LD block contains invalid JSON', () => {
    const features = featuresFromHtml(structuredDataDomain, HTML_INVALID_JSON_LD);
    const findings = structuredDataDomain.evaluate(features);

    const parseErrors = findings.filter((f) => f.ruleId === RULE_PARSE_ERROR);
    expect(parseErrors.length).toBeGreaterThanOrEqual(1);
    expect(parseErrors[0]?.severity).toBe('critical');
    expect(parseErrors[0]?.domain).toBe('structured-data');
  });

  it('emits sd-image-object-description at moderate severity when ImageObject lacks description', () => {
    const features = featuresFromHtml(structuredDataDomain, HTML_IMAGE_OBJECT_NO_DESCRIPTION);
    const findings = structuredDataDomain.evaluate(features);

    const descFindings = findings.filter((f) => f.ruleId === RULE_IMAGE_OBJECT_DESCRIPTION);
    expect(descFindings.length).toBeGreaterThanOrEqual(1);
    // Moderate (not serious or critical) — this is an interaction signal.
    expect(descFindings[0]?.severity).toBe('moderate');
    expect(descFindings[0]?.domain).toBe('structured-data');
  });

  it('emits sd-product-required when Product schema is missing the name field', () => {
    const features = featuresFromHtml(structuredDataDomain, HTML_PRODUCT_MISSING_NAME);
    const findings = structuredDataDomain.evaluate(features);

    const productFindings = findings.filter(
      (f) => f.ruleId === RULE_PRODUCT_REQUIRED && f.message.includes('"name"'),
    );
    expect(productFindings.length).toBeGreaterThanOrEqual(1);
    expect(productFindings[0]?.severity).toBe('serious');
  });

  it('emits sd-price-validity (critical) when Product Offer has no priceValidUntil', () => {
    const features = featuresFromHtml(structuredDataDomain, HTML_PRODUCT_NO_PRICE_VALIDITY);
    const findings = structuredDataDomain.evaluate(features);

    const priceFindings = findings.filter((f) => f.ruleId === RULE_PRICE_VALIDITY);
    expect(priceFindings.length).toBeGreaterThanOrEqual(1);
    expect(priceFindings[0]?.severity).toBe('critical');
  });

  it('emits sd-price-validity (critical) when Product Offer priceValidUntil date is in the past', () => {
    const features = featuresFromHtml(structuredDataDomain, HTML_PRODUCT_PAST_PRICE_VALIDITY);
    const findings = structuredDataDomain.evaluate(features);

    const priceFindings = findings.filter((f) => f.ruleId === RULE_PRICE_VALIDITY);
    expect(priceFindings.length).toBeGreaterThanOrEqual(1);
    expect(priceFindings[0]?.severity).toBe('critical');
    // The message should contain the expired date for diagnostics.
    expect(priceFindings[0]?.message).toContain('2000-01-01');
  });

  it('emits sd-article-required when Article schema is missing author.name', () => {
    const features = featuresFromHtml(structuredDataDomain, HTML_ARTICLE_MISSING_AUTHOR_NAME);
    const findings = structuredDataDomain.evaluate(features);

    const authorFindings = findings.filter(
      (f) => f.ruleId === RULE_ARTICLE_REQUIRED && f.message.includes('author.name'),
    );
    expect(authorFindings.length).toBeGreaterThanOrEqual(1);
    expect(authorFindings[0]?.severity).toBe('serious');
  });
});

// ---------------------------------------------------------------------------
// 3. Negative finding cases (false-positive invariant)
// ---------------------------------------------------------------------------

describe('Structured-data rule engine — negative cases (no false positives)', () => {
  it('produces no findings when there are no JSON-LD blocks on the page', () => {
    const features = featuresFromHtml(structuredDataDomain, HTML_EMPTY);
    const findings = structuredDataDomain.evaluate(features);

    expect(findings).toHaveLength(0);
  });

  it('produces no parse-error finding for a valid JSON-LD block', () => {
    const features = featuresFromHtml(structuredDataDomain, HTML_PRODUCT_COMPLETE);
    const findings = structuredDataDomain.evaluate(features);

    const parseErrors = findings.filter((f) => f.ruleId === RULE_PARSE_ERROR);
    expect(parseErrors).toHaveLength(0);
  });

  it('produces no sd-image-object-description finding when ImageObject has a description', () => {
    const features = featuresFromHtml(structuredDataDomain, HTML_IMAGE_OBJECT_WITH_DESCRIPTION);
    const findings = structuredDataDomain.evaluate(features);

    const descFindings = findings.filter((f) => f.ruleId === RULE_IMAGE_OBJECT_DESCRIPTION);
    expect(descFindings).toHaveLength(0);
  });

  it('produces no product-required findings for a complete Product schema', () => {
    const features = featuresFromHtml(structuredDataDomain, HTML_PRODUCT_COMPLETE);
    const findings = structuredDataDomain.evaluate(features);

    const productFindings = findings.filter((f) => f.ruleId === RULE_PRODUCT_REQUIRED);
    expect(productFindings).toHaveLength(0);
  });

  it('produces no price-validity finding for a Product with a future priceValidUntil date', () => {
    const features = featuresFromHtml(structuredDataDomain, HTML_PRODUCT_COMPLETE);
    const findings = structuredDataDomain.evaluate(features);

    const priceFindings = findings.filter((f) => f.ruleId === RULE_PRICE_VALIDITY);
    expect(priceFindings).toHaveLength(0);
  });

  it('produces no article-required findings for a complete Article schema', () => {
    const features = featuresFromHtml(structuredDataDomain, HTML_ARTICLE_COMPLETE);
    const findings = structuredDataDomain.evaluate(features);

    const articleFindings = findings.filter((f) => f.ruleId === RULE_ARTICLE_REQUIRED);
    expect(articleFindings).toHaveLength(0);
  });

  it('evaluate returns an empty array when called with empty features (no perDocument ever ran)', () => {
    const emptyFeatures: ExtractedFeatures = {
      byElement: new Map(),
      byDocument: new Map(),
    };
    const findings = structuredDataDomain.evaluate(emptyFeatures);
    expect(findings).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 4. Interaction-feature case — element-scoped SD_IMAGE_ANCHOR for cross-domain pairing
// ---------------------------------------------------------------------------

describe('Structured-data interaction feature for cross-domain pairing', () => {
  it('perElement emits SD_IMAGE_ANCHOR on an IMG element so the cross-domain detector can join it with accessibility missing-alt', () => {
    // The cross-domain detector joins features from different domains that share
    // the same (scope, joinValue) — here scope=element, joinValue=the IMG selector.
    // Both accessibility (a11y:missing-alt) and structured-data (sd:image-anchor)
    // must appear in byElement[selector].domainFeatures for the detector to fire
    // the accessibility|structured-data|element seed pair.
    const imgSelector = 'img.hero';
    const el: ElementHandle = { nodeName: 'IMG', selector: imgSelector };

    const features = runPerElement(structuredDataDomain, el);

    // The structured-data domain must have placed a feature on this element.
    const bucket = features.byElement.get(imgSelector);
    expect(bucket).toBeDefined();
    expect(bucket?.domainFeatures['structured-data']).toBeDefined();
    expect(bucket?.domainFeatures['structured-data']?.get(SD_IMAGE_ANCHOR)).toBe(true);
  });

  it('perElement does NOT emit SD_IMAGE_ANCHOR on non-IMG elements', () => {
    // The interaction feature must only appear on IMG elements — emitting it on
    // every element would create false cross-domain pairings.
    const nonImageSelectors: Array<{ nodeName: string; selector: string }> = [
      { nodeName: 'P', selector: 'p.intro' },
      { nodeName: 'SCRIPT', selector: 'script.ld-json' },
      { nodeName: 'DIV', selector: 'div.wrapper' },
      { nodeName: 'A', selector: 'a.link' },
    ];

    for (const entry of nonImageSelectors) {
      const el: ElementHandle = { nodeName: entry.nodeName, selector: entry.selector };
      const features = runPerElement(structuredDataDomain, el);
      // Either the element has no bucket at all, or it has one but with no SD_IMAGE_ANCHOR.
      const bucket = features.byElement.get(entry.selector);
      const sdFeatures = bucket?.domainFeatures['structured-data'];
      const hasAnchor = sdFeatures?.get(SD_IMAGE_ANCHOR);
      expect(hasAnchor).toBeFalsy();
    }
  });

  it('the declared interactionFeature has joinScope "element" matching the accessibility|structured-data|element seed pair', () => {
    // The cross-domain detector looks up the pair key as
    // "accessibility|structured-data|element" in the weights JSON. The structured-data
    // domain must declare an interactionFeature with joinScope: 'element'.
    const spec = structuredDataDomain.interactionFeatures?.find(
      (f) => f.key === SD_IMAGE_ANCHOR,
    );
    expect(spec).toBeDefined();
    expect(spec?.joinScope).toBe('element');
  });

  it('perDocument stores schema blocks so evaluate can recover them without re-parsing HTML', () => {
    // The SD_SCHEMA_BLOCKS feature is stored in byDocument so evaluate() can
    // access the parsed schema data without accessing the snapshot HTML again.
    const features = runPerDocument(structuredDataDomain, makeSnapshot(HTML_IMAGE_OBJECT_NO_DESCRIPTION));

    const stored = features.byDocument.get(SD_SCHEMA_BLOCKS);
    expect(typeof stored).toBe('string');

    // The stored value must be parseable JSON and contain the ImageObject block.
    const parsed = JSON.parse(stored as string) as unknown[];
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBeGreaterThan(0);

    const imageBlock = (parsed as Array<{ types: string[] }>).find(
      (b) => b.types?.includes('ImageObject'),
    );
    expect(imageBlock).toBeDefined();
  });

  it('both accessibility and structured-data features on the same IMG selector enable cross-domain correlation', () => {
    // Simulate what the shared walker produces after both domains run perElement
    // on the same IMG: both domain feature maps appear in byElement[selector].
    // This is the joint state the cross-domain detector reads.
    const selector = 'img.banner';

    const syntheticFeatures: ExtractedFeatures = {
      byElement: new Map([
        [
          selector,
          {
            domainFeatures: {
              accessibility: new Map([['a11y:missing-alt', true]]),
              'structured-data': new Map([[SD_IMAGE_ANCHOR, true]]),
            },
          },
        ],
      ]),
      byDocument: new Map(),
    };

    // Both domains are present on the same element selector — the condition the
    // cross-domain detector requires to score the interaction pair.
    const bucket = syntheticFeatures.byElement.get(selector);
    expect(bucket?.domainFeatures['accessibility']?.get('a11y:missing-alt')).toBe(true);
    expect(bucket?.domainFeatures['structured-data']?.get(SD_IMAGE_ANCHOR)).toBe(true);
  });
});
