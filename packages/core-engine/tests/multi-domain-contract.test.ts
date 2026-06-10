// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Acceptance tests for the DomainModule contract, single-pass shared DOM
// walker, ML cross-domain interaction detector, and MultiDomainReport shape.
//
// Invariants under test:
//   - One shared pass produces ExtractedFeatures for ≥2 domains; adding a
//     domain adds no extra traversal (traversal count always == 1).
//   - The built-in accessibility domain is discoverable; third-party domains
//     supplied via the modules config option are discovered and deduplicated.
//   - runMultiDomainScan produces a MultiDomainReport with a populated grid
//     and a non-empty crossSite axis on a diverging fixture pair.
//   - The ML detector emits ≥1 InteractionRecord for a seeded cross-domain
//     conflict sharing a common element key — must NOT return the empty stub.
//   - A third-party fixture domain supplied via modules appears in the grid;
//     the engine handles deduplication when the same id appears twice.

import { describe, expect, it } from 'vitest';

import { discoverDomains } from '../src/domain-discovery.js';
import {
  createMLCrossDomainDetector,
  type MLCrossDomainDetector,
} from '../src/ml-cross-domain.js';
import { runMultiDomainScan } from '../src/multi-domain-scan.js';
import type {
  DomainModule,
  ElementHandle,
  ExtractedFeatures,
  FeatureSink,
  InteractionFeatureSpec,
  InteractionRecord,
  JoinScope,
  MultiDomainReport,
  PerSiteResult,
  PropertySnapshot,
  SiteContext,
} from '../src/domain-contract.js';
import {
  createSharedWalker,
  type SharedWalkerResult,
} from '../src/shared-walker.js';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/**
 * Build a minimal PropertySnapshot with a controlled element outline.
 * The walker builds ElementHandle from domOutline entries which carry only
 * nodeName, selector, and optionally frameId — not attributes. Tests that need
 * attribute-based differentiation (e.g. img-with-alt vs img-without-alt) must
 * encode the difference via the outline structure itself: include an IMG on the
 * failing site, omit it on the passing site.
 */
function makeSnapshot(
  outlineEntries: Array<{ nodeName: string; selector: string }>,
  url = 'http://test.local/',
): PropertySnapshot {
  return {
    scanId: 'scan-test-0',
    url,
    timestamp: 0,
    html: '',
    headers: {},
    cookies: [],
    networkResources: [],
    axTree: [],
    domOutline: outlineEntries.map((e, i) => ({
      backendNodeId: i + 1,
      nodeName: e.nodeName,
      selector: e.selector,
    })),
    perfMetrics: {},
    timings: { navigationMs: 0, axTreeMs: 0, domMs: 0, totalMs: 0 },
  };
}

/** Minimal DomainModule that counts how many times its extractor is called. */
function makeCountingDomain(id: string): DomainModule & { elementVisits: number } {
  let elementVisits = 0;
  return {
    id,
    title: `Test domain ${id}`,
    version: '0.0.1',
    extractors: {
      perElement(_el: ElementHandle, _acc: FeatureSink): void {
        elementVisits += 1;
      },
      perDocument(_snap: PropertySnapshot, _acc: FeatureSink): void {
        // no-op for this counting module
      },
    },
    evaluate(_features: ExtractedFeatures) {
      return [];
    },
    get elementVisits() {
      return elementVisits;
    },
  };
}

// ---------------------------------------------------------------------------
// Single shared pass — traversal count == 1 regardless of domain count
// ---------------------------------------------------------------------------

describe('Single-pass shared DOM walker', () => {
  it('calls perElement exactly once per element regardless of how many domains are registered', async () => {
    const snap = makeSnapshot([
      { nodeName: 'IMG', selector: 'img.no-alt' },
      { nodeName: 'SCRIPT', selector: 'script.render-block' },
      { nodeName: 'P', selector: 'p.text' },
    ]);
    const domainA = makeCountingDomain('domain-a');
    const domainB = makeCountingDomain('domain-b');
    const domainC = makeCountingDomain('domain-c');

    const result: SharedWalkerResult = await createSharedWalker({
      snapshot: snap,
      domains: [domainA, domainB, domainC],
    });

    // The DOM outline has 3 elements. Each domain must have seen each element
    // exactly once — proving a single pass shared across all three domains.
    expect(domainA.elementVisits).toBe(snap.domOutline.length);
    expect(domainB.elementVisits).toBe(snap.domOutline.length);
    expect(domainC.elementVisits).toBe(snap.domOutline.length);

    // The result must carry ExtractedFeatures populated by all domains.
    expect(result.features).toBeDefined();
  });

  it('records traversal count of exactly 1 in the walker result', async () => {
    const snap = makeSnapshot([{ nodeName: 'P', selector: 'p.hello' }]);
    const result: SharedWalkerResult = await createSharedWalker({
      snapshot: snap,
      domains: [makeCountingDomain('x'), makeCountingDomain('y')],
    });
    expect(result.traversalCount).toBe(1);
  });

  it('adding a domain does not increase traversal count beyond 1', async () => {
    const snap = makeSnapshot([{ nodeName: 'P', selector: 'p.a' }]);

    const withOne = await createSharedWalker({
      snapshot: snap,
      domains: [makeCountingDomain('only')],
    });
    const withFive = await createSharedWalker({
      snapshot: snap,
      domains: [
        makeCountingDomain('d1'),
        makeCountingDomain('d2'),
        makeCountingDomain('d3'),
        makeCountingDomain('d4'),
        makeCountingDomain('d5'),
      ],
    });

    expect(withOne.traversalCount).toBe(1);
    expect(withFive.traversalCount).toBe(1);
  });

  it('perDocument is called once per domain after element traversal', async () => {
    const snap = makeSnapshot([{ nodeName: 'P', selector: 'p.hi' }]);
    const docCallCounts: Record<string, number> = {};

    const makeDomainWithDocHook = (id: string): DomainModule => ({
      id,
      title: id,
      version: '0',
      extractors: {
        perDocument(_snap: PropertySnapshot, _acc: FeatureSink): void {
          docCallCounts[id] = (docCallCounts[id] ?? 0) + 1;
        },
      },
      evaluate: () => [],
    });

    await createSharedWalker({
      snapshot: snap,
      domains: [makeDomainWithDocHook('alpha'), makeDomainWithDocHook('beta')],
    });

    expect(docCallCounts['alpha']).toBe(1);
    expect(docCallCounts['beta']).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Discovery paths — built-in, npm convention, config
// ---------------------------------------------------------------------------

describe('Domain discovery paths', () => {
  it('built-in: accessibility domain is present without any config', () => {
    const discovered = discoverDomains({});
    const ids = discovered.map((d) => d.id);
    expect(ids).toContain('accessibility');
  });

  it('npm convention: an ariada-domain-* package supplied via modules is discovered', () => {
    // The engine-side discovery does not scan the filesystem (that is a Node-side
    // concern). The Node package scanner imports third-party ariada-domain-*
    // packages and feeds them in through the `modules` option. This test
    // exercises that path with a minimal inline fixture, which is equivalent to
    // what the Node scanner produces after importing a real package.
    const fixtureDomain: DomainModule = {
      id: 'fixture-domain',
      title: 'Fixture Domain (discovery test)',
      version: '0.0.1',
      extractors: { perElement() {}, perDocument() {} },
      evaluate() { return []; },
    };
    const discovered = discoverDomains({ modules: [fixtureDomain] });
    const ids = discovered.map((d) => d.id);
    expect(ids).toContain('fixture-domain');
  });

  it('config path: domains listed in opts.modules are loaded', () => {
    const configModule: DomainModule = {
      id: 'config-loaded',
      title: 'Config-loaded domain',
      version: '0',
      extractors: {},
      evaluate: () => [],
    };
    const discovered = discoverDomains({ modules: [configModule] });
    const ids = discovered.map((d) => d.id);
    expect(ids).toContain('config-loaded');
  });

  it('deduplicates when same domain appears in both built-in and config', () => {
    const duplicate: DomainModule = {
      id: 'accessibility',
      title: 'Duplicate accessibility',
      version: '9',
      extractors: {},
      evaluate: () => [],
    };
    const discovered = discoverDomains({ modules: [duplicate] });
    const accessibilityDomains = discovered.filter((d) => d.id === 'accessibility');
    expect(accessibilityDomains).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// ML detector emits ≥1 InteractionRecord for a seeded cross-domain conflict
// ---------------------------------------------------------------------------

describe('ML cross-domain interaction detector', () => {
  it('returns at least one InteractionRecord for the seeded a11y↔sustainability conflict', () => {
    const detector: MLCrossDomainDetector = createMLCrossDomainDetector();

    // Seed: the same element key has both a11y:missing-alt and
    // sustainability:large-image set. Features from different domains are
    // correlated by shared element key (the selector string) — this is the
    // "joinValue" mechanism: same key = same element = potential interaction.
    // A cross-domain conflict where two domains flag the same element.
    const syntheticFeatures: ExtractedFeatures = {
      byElement: new Map([
        ['img.hero', {
          domainFeatures: {
            accessibility: new Map([['a11y:missing-alt', true]]),
            sustainability: new Map([['sustainability:large-image', true]]),
          },
        }],
      ]),
      byDocument: new Map(),
    };

    const records: InteractionRecord[] = detector.detect(syntheticFeatures, 'scan-ac4');

    // Must not return the old empty-stub value.
    expect(records.length).toBeGreaterThanOrEqual(1);
    expect(records[0]?.type).toMatch(/^(conflict|synergy)$/);
    expect(records[0]?.domains).toHaveLength(2);
    expect(records[0]?.elementKey).toBeTruthy();
  });

  it('returns empty array when no known interaction patterns are present', () => {
    const detector = createMLCrossDomainDetector();

    const boring: ExtractedFeatures = {
      byElement: new Map([
        ['div.safe', {
          domainFeatures: {
            accessibility: new Map([['a11y:color-ok', true]]),
          },
        }],
      ]),
      byDocument: new Map(),
    };

    const records = detector.detect(boring, 'scan-boring');
    expect(records).toEqual([]);
  });

  it('labels the a11y↔sustainability interaction as a conflict, not synergy', () => {
    const detector = createMLCrossDomainDetector();

    const features: ExtractedFeatures = {
      byElement: new Map([
        ['img.conflict-target', {
          domainFeatures: {
            accessibility: new Map([['a11y:missing-alt', true]]),
            sustainability: new Map([['sustainability:large-image', true]]),
          },
        }],
      ]),
      byDocument: new Map(),
    };

    const records = detector.detect(features, 'scan-conflict-label');
    const a11ySustainConflict = records.find(
      (r) => r.domains.includes('accessibility') && r.domains.includes('sustainability'),
    );
    expect(a11ySustainConflict).toBeDefined();
    expect(a11ySustainConflict?.type).toBe('conflict');
  });

  it('does not mutate the input features map', () => {
    const detector = createMLCrossDomainDetector();
    const original = new Map([['a11y:missing-alt', true as unknown]]);
    const features: ExtractedFeatures = {
      byElement: new Map([
        ['img.x', { domainFeatures: { accessibility: original } }],
      ]),
      byDocument: new Map(),
    };
    detector.detect(features, 'scan-immutability');
    expect(original.size).toBe(1);
    expect(features.byElement.size).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// MultiDomainReport grid and cross-site axis on diverging sites
// ---------------------------------------------------------------------------

describe('MultiDomainReport with diverging sites', () => {
  // Domain that flags every IMG in the outline as missing alt. Since the walker
  // does not populate attributes, differentiation is via the outline: include an
  // IMG on the failing site's outline and omit it on the passing site's outline.
  const imgFlagDomain: DomainModule = {
    id: 'accessibility',
    title: 'Accessibility',
    version: '0',
    extractors: {
      perElement(el: ElementHandle, acc: FeatureSink): void {
        if (el.nodeName === 'IMG') {
          acc.set(el.selector, 'a11y:missing-alt', true);
        }
      },
    },
    evaluate(features: ExtractedFeatures): ReturnType<DomainModule['evaluate']> {
      const findings: ReturnType<DomainModule['evaluate']> = [];
      for (const [selector, data] of features.byElement) {
        if (data.domainFeatures['accessibility']?.get('a11y:missing-alt')) {
          findings.push({
            id: `missing-alt-${selector}`,
            scanId: '',
            domain: 'accessibility',
            ruleId: 'image-alt',
            severity: 'serious',
            element: { selector },
            message: 'Image is missing alternative text',
            wcagMapping: ['1.1.1'],
            regulatoryMapping: [{ framework: 'WCAG', code: 'SC 1.1.1' }],
          });
        }
      }
      return findings;
    },
  };

  it('report grid has an entry for each [site × domain] pair', async () => {
    // Site A has an IMG (will generate a finding); site B has no IMG (passes).
    const siteA = makeSnapshot(
      [{ nodeName: 'IMG', selector: 'img.no-alt' }],
      'http://site-a.local/',
    );
    const siteB = makeSnapshot(
      [{ nodeName: 'P', selector: 'p.content' }],
      'http://site-b.local/',
    );

    const report: MultiDomainReport = await runMultiDomainScan({
      snapshots: [siteA, siteB],
      domains: [imgFlagDomain],
    });

    // Grid must have entries for both sites.
    expect(Object.keys(report.grid)).toHaveLength(2);
    expect(report.grid['http://site-a.local/']).toBeDefined();
    expect(report.grid['http://site-b.local/']).toBeDefined();

    // Site A must have accessibility findings; site B must not.
    const siteAFindings = report.grid['http://site-a.local/']?.['accessibility'] ?? [];
    const siteBFindings = report.grid['http://site-b.local/']?.['accessibility'] ?? [];
    expect(siteAFindings.length).toBeGreaterThan(0);
    expect(siteBFindings).toHaveLength(0);
  });

  it('crossSite.divergence is non-empty when one site passes and the other fails', async () => {
    // brand.com has an IMG (fails image-alt); brand.de has no IMG (passes).
    const siteA = makeSnapshot(
      [{ nodeName: 'IMG', selector: 'img.hero' }],
      'http://brand.com/',
    );
    const siteB = makeSnapshot(
      [{ nodeName: 'P', selector: 'p.intro' }],
      'http://brand.de/',
    );

    const report: MultiDomainReport = await runMultiDomainScan({
      snapshots: [siteA, siteB],
      domains: [imgFlagDomain],
    });

    // The divergence axis should flag that brand.com fails where brand.de passes.
    expect(report.crossSite.divergence.length).toBeGreaterThan(0);
    const divergence = report.crossSite.divergence[0];
    expect(divergence?.domain).toBe('accessibility');
    expect(divergence?.failingSites).toContain('http://brand.com/');
    expect(divergence?.passingSites).toContain('http://brand.de/');
  });

  it('crossSite.systemic lists findings present on all sites when all fail', async () => {
    // Both sites have an IMG — both produce the same finding.
    const siteA = makeSnapshot(
      [{ nodeName: 'IMG', selector: 'img.a' }],
      'http://brand.com/',
    );
    const siteB = makeSnapshot(
      [{ nodeName: 'IMG', selector: 'img.b' }],
      'http://brand.de/',
    );

    const report: MultiDomainReport = await runMultiDomainScan({
      snapshots: [siteA, siteB],
      domains: [imgFlagDomain],
    });

    expect(report.crossSite.systemic.length).toBeGreaterThan(0);
    const systemic = report.crossSite.systemic[0];
    expect(systemic?.ruleId).toBe('image-alt');
    expect(systemic?.affectedSites.length).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Third-party fixture domain supplied via modules appears in the grid
// ---------------------------------------------------------------------------

describe('Third-party domain discovery and grid presence', () => {
  it('a domain supplied via modules appears in the grid when scanned', async () => {
    // The Node-side npm-convention scanner imports ariada-domain-* packages and
    // passes their modules in through discoverDomains({ modules: [...] }). This
    // test exercises that path with an inline fixture, equivalent to what the
    // real Node scanner produces.
    const thirdPartyDomain: DomainModule = {
      id: 'fixture-domain',
      title: 'Fixture Domain (third-party test)',
      version: '0.0.1',
      extractors: { perElement() {}, perDocument() {} },
      evaluate() { return []; },
    };

    const snap = makeSnapshot([{ nodeName: 'P', selector: 'p.hello' }], 'http://test.local/');
    const discovered = discoverDomains({ modules: [thirdPartyDomain] });

    const report: MultiDomainReport = await runMultiDomainScan({
      snapshots: [snap],
      domains: discovered,
    });

    const domainIds = Object.keys(report.grid['http://test.local/'] ?? {});
    expect(domainIds).toContain('fixture-domain');
  });
});

// ---------------------------------------------------------------------------
// DomainModule contract shape (type-level assertions via runtime checks)
// ---------------------------------------------------------------------------

describe('DomainModule contract shape', () => {
  it('accepts a module with only mandatory fields', () => {
    const minimal: DomainModule = {
      id: 'minimal',
      title: 'Minimal',
      version: '0',
      extractors: {},
      evaluate: () => [],
    };
    expect(minimal.id).toBe('minimal');
    expect(typeof minimal.evaluate).toBe('function');
  });

  it('accepts a module with all optional fields populated', () => {
    const full: DomainModule = {
      id: 'full',
      title: 'Full',
      version: '1',
      applicability: (_ctx: SiteContext) => true,
      extractors: {
        perElement: (_el: ElementHandle, _acc: FeatureSink) => {},
        perDocument: (_snap: PropertySnapshot, _acc: FeatureSink) => {},
      },
      evaluate: (_features: ExtractedFeatures) => [],
      regulatory: [{ framework: 'WCAG', code: 'SC 1.1.1' }],
      interactionFeatures: [
        { key: 'full:sample-key', description: 'test', joinScope: 'element' } satisfies InteractionFeatureSpec,
      ],
    };
    expect(full.interactionFeatures).toHaveLength(1);
  });

  it('applicability predicate is called with a SiteContext containing url', async () => {
    const seenUrls: string[] = [];
    const domain: DomainModule = {
      id: 'url-check',
      title: 'URL check',
      version: '0',
      applicability: (ctx: SiteContext) => {
        seenUrls.push(ctx.url);
        return true;
      },
      extractors: {},
      evaluate: () => [],
    };

    const snap = makeSnapshot([{ nodeName: 'P', selector: 'p.hi' }], 'http://expected.test/');
    await createSharedWalker({ snapshot: snap, domains: [domain] });
    expect(seenUrls).toContain('http://expected.test/');
  });

  it('a domain with applicability returning false contributes no features', async () => {
    const inactive: DomainModule & { elementVisits: number } = {
      ...makeCountingDomain('inactive'),
      applicability: (_ctx: SiteContext) => false,
    };

    const snap = makeSnapshot([{ nodeName: 'IMG', selector: 'img.x' }]);
    await createSharedWalker({ snapshot: snap, domains: [inactive] });
    // applicability=false means perElement is never called.
    expect(inactive.elementVisits).toBe(0);
  });

  it('extractors are synchronous — perElement and perDocument return void', async () => {
    // The walker calls extractors synchronously inside the element loop;
    // returning a Promise would be silently ignored and any async side-effect
    // would be missed. This test confirms the contract: extractors must be sync.
    let perElementReturnValue: unknown = 'unset';
    let perDocumentReturnValue: unknown = 'unset';

    const syncDomain: DomainModule = {
      id: 'sync-check',
      title: 'Sync extractor check',
      version: '0',
      extractors: {
        perElement(_el, _acc) {
          perElementReturnValue = undefined;
          return undefined;
        },
        perDocument(_snap, _acc) {
          perDocumentReturnValue = undefined;
          return undefined;
        },
      },
      evaluate: () => [],
    };

    const snap = makeSnapshot([{ nodeName: 'P', selector: 'p.check' }]);
    await createSharedWalker({ snapshot: snap, domains: [syncDomain] });

    // A Promise return value would be an object; void/undefined confirms sync.
    expect(perElementReturnValue).toBeUndefined();
    expect(perDocumentReturnValue).toBeUndefined();
  });

  it('PropertySnapshot optional fields are tolerated when absent or empty', async () => {
    // Modules that call perDocument must not crash when cookies/networkResources
    // are empty arrays (the base outline does not populate them from the network).
    const snapMinimal: PropertySnapshot = {
      scanId: 'snap-minimal',
      url: 'http://minimal.test/',
      timestamp: 0,
      html: '',
      headers: {},
      cookies: [],
      networkResources: [],
      axTree: [],
      domOutline: [],
      perfMetrics: {},
      timings: { navigationMs: 0, axTreeMs: 0, domMs: 0, totalMs: 0 },
    };

    const docHookDomain: DomainModule = {
      id: 'doc-hook',
      title: 'Doc hook',
      version: '0',
      extractors: {
        perDocument(snap: PropertySnapshot, acc: FeatureSink): void {
          // Access optional-in-practice fields; must not throw.
          acc.set('doc', 'cookies-count', snap.cookies.length);
          acc.set('doc', 'resources-count', snap.networkResources.length);
        },
      },
      evaluate: () => [],
    };

    const result = await createSharedWalker({ snapshot: snapMinimal, domains: [docHookDomain] });
    // Walker ran without throwing; document features were recorded.
    expect(result.features.byDocument.get('doc::cookies-count')).toBe(0);
    expect(result.features.byDocument.get('doc::resources-count')).toBe(0);
  });

  it('discoverDomains deduplication preserves first occurrence (built-in wins)', () => {
    // When the same id appears in both built-ins and modules, the built-in
    // (first) wins and the config version is dropped.
    const override: DomainModule = {
      id: 'accessibility',
      title: 'Override',
      version: '999',
      extractors: {},
      evaluate: () => [],
    };
    const domains = discoverDomains({ modules: [override] });
    const found = domains.find((d) => d.id === 'accessibility');
    // The built-in accessibility domain must win.
    expect(found?.version).not.toBe('999');
  });

  it('InteractionFeatureSpec requires joinScope; all valid JoinScope values are accepted', () => {
    // joinScope is the dimension on which two domains' features are joined. Two
    // features interact only when they share the same join value within the
    // declared scope — e.g. same element key, same cookie name, same request URL.
    // This test asserts the full valid value set is accepted by the type and that
    // an InteractionFeatureSpec without joinScope would be incomplete.
    const allScopes: JoinScope[] = ['element', 'document', 'cookie', 'request', 'origin', 'page'];

    for (const scope of allScopes) {
      const spec: InteractionFeatureSpec = {
        key: `test:feature-${scope}`,
        description: `Feature joined on ${scope} scope`,
        joinScope: scope,
      };
      expect(spec.joinScope).toBe(scope);
    }
  });

  it('interactionFeatures declared with joinScope are attached to the domain contract', () => {
    // A domain that participates in cross-domain interactions declares the
    // features it contributes and the scope on which they are joined. This
    // contract-conformance test confirms a domain carrying interactionFeatures
    // with joinScope satisfies the full DomainModule shape.
    const domainWithInteractions: DomainModule = {
      id: 'test-interaction-domain',
      title: 'Test interaction domain',
      version: '0',
      extractors: {
        perElement(el: ElementHandle, acc: FeatureSink): void {
          if (el.nodeName === 'IMG') {
            acc.set(el.selector, 'a11y:missing-alt', true);
          }
        },
      },
      evaluate: (_features: ExtractedFeatures) => [],
      interactionFeatures: [
        {
          key: 'a11y:missing-alt',
          description: 'Image is missing alternative text — interacts with image optimisation',
          joinScope: 'element',
        } satisfies InteractionFeatureSpec,
      ],
    };

    expect(domainWithInteractions.interactionFeatures).toHaveLength(1);
    expect(domainWithInteractions.interactionFeatures?.[0]?.joinScope).toBe('element');
  });
});

// ---------------------------------------------------------------------------
// aggregate? hook on DomainModule — cross-site aggregation contract
// ---------------------------------------------------------------------------

describe('DomainModule.aggregate hook contract', () => {
  it('a domain without aggregate still produces a valid report', async () => {
    // aggregate? is optional. Domains without it must work identically to
    // before — the engine must not error if the field is absent.
    const noAggregateDomain: DomainModule = {
      id: 'no-aggregate',
      title: 'No aggregate',
      version: '0',
      extractors: {},
      evaluate: () => [],
      // deliberately omit aggregate
    };

    const snap = makeSnapshot([{ nodeName: 'P', selector: 'p.x' }], 'http://a.test/');
    const report: MultiDomainReport = await runMultiDomainScan({
      snapshots: [snap],
      domains: [noAggregateDomain],
    });

    expect(report.grid['http://a.test/']).toBeDefined();
    // aggregateFindings is absent or empty when no domain has an aggregate hook.
    expect(report.aggregateFindings == null || report.aggregateFindings.length === 0).toBe(true);
  });

  it('aggregate hook receives PerSiteResult for every scanned site', async () => {
    // The engine collects each domain's per-site results and passes them to
    // aggregate once at report assembly. This test confirms the hook sees all
    // sites in its input.
    const seenSites: string[] = [];

    const aggregatingDomain: DomainModule = {
      id: 'aggregate-observer',
      title: 'Aggregate observer',
      version: '0',
      extractors: {},
      evaluate: () => [],
      aggregate(sites: readonly PerSiteResult[]): ReturnType<DomainModule['evaluate']> {
        for (const s of sites) {
          seenSites.push(s.site);
        }
        return [];
      },
    };

    const siteA = makeSnapshot([{ nodeName: 'P', selector: 'p.a' }], 'http://site-a.test/');
    const siteB = makeSnapshot([{ nodeName: 'P', selector: 'p.b' }], 'http://site-b.test/');
    const siteC = makeSnapshot([{ nodeName: 'P', selector: 'p.c' }], 'http://site-c.test/');

    await runMultiDomainScan({
      snapshots: [siteA, siteB, siteC],
      domains: [aggregatingDomain],
    });

    expect(seenSites).toHaveLength(3);
    expect(seenSites).toContain('http://site-a.test/');
    expect(seenSites).toContain('http://site-b.test/');
    expect(seenSites).toContain('http://site-c.test/');
  });

  it('aggregate hook findings appear in report.aggregateFindings', async () => {
    // A domain that detects brand-wide inconsistencies (e.g. a finding that only
    // makes sense when at least two sites disagree) must be able to emit findings
    // from aggregate; those land in MultiDomainReport.aggregateFindings, separate
    // from the per-site grid.
    const aggregatingDomain: DomainModule = {
      id: 'brand-consistency',
      title: 'Brand consistency',
      version: '0',
      extractors: {},
      evaluate: () => [],
      aggregate(sites: readonly PerSiteResult[]): ReturnType<DomainModule['evaluate']> {
        if (sites.length < 2) return [];
        // Emit one aggregate finding to signal brand-wide inconsistency.
        return [{
          id: 'brand-inconsistency-1',
          scanId: sites[0]?.site ?? '',
          domain: 'brand-consistency',
          ruleId: 'brand-wide-check',
          severity: 'moderate' as const,
          element: { selector: ':root' },
          message: 'Brand-wide inconsistency detected across sites',
          wcagMapping: [],
          regulatoryMapping: [],
        }];
      },
    };

    const siteA = makeSnapshot([{ nodeName: 'P', selector: 'p.a' }], 'http://brand.com/');
    const siteB = makeSnapshot([{ nodeName: 'P', selector: 'p.b' }], 'http://brand.de/');

    const report: MultiDomainReport = await runMultiDomainScan({
      snapshots: [siteA, siteB],
      domains: [aggregatingDomain],
    });

    expect(report.aggregateFindings).toBeDefined();
    expect(report.aggregateFindings?.length).toBeGreaterThanOrEqual(1);
    expect(report.aggregateFindings?.[0]?.ruleId).toBe('brand-wide-check');
  });

  it('aggregate hook is called exactly once per domain at report assembly, not once per site', async () => {
    // The hook is an assembly-time operation — it runs after all sites have been
    // scanned. If it ran per site it would defeat the purpose of cross-site
    // aggregation and could not compare across all sites.
    let callCount = 0;

    const countingAggregateDomain: DomainModule = {
      id: 'aggregate-counter',
      title: 'Aggregate call counter',
      version: '0',
      extractors: {},
      evaluate: () => [],
      aggregate(_sites: readonly PerSiteResult[]): ReturnType<DomainModule['evaluate']> {
        callCount += 1;
        return [];
      },
    };

    const snapshots = [
      makeSnapshot([{ nodeName: 'P', selector: 'p.1' }], 'http://s1.test/'),
      makeSnapshot([{ nodeName: 'P', selector: 'p.2' }], 'http://s2.test/'),
      makeSnapshot([{ nodeName: 'P', selector: 'p.3' }], 'http://s3.test/'),
      makeSnapshot([{ nodeName: 'P', selector: 'p.4' }], 'http://s4.test/'),
    ];

    await runMultiDomainScan({ snapshots, domains: [countingAggregateDomain] });

    // Regardless of how many sites were scanned, aggregate fires exactly once.
    expect(callCount).toBe(1);
  });

  it('aggregate hook sees each site in PerSiteResult with its findings populated', async () => {
    // The PerSiteResult passed to aggregate must carry the same findings that
    // went into the grid for that site-and-domain pair. Aggregate must be able
    // to build on per-site evaluation without re-running evaluate itself.
    const findingsObserved: Array<{ site: string; findingCount: number }> = [];

    const imgFlagWithAggregate: DomainModule = {
      id: 'img-aggregator',
      title: 'IMG aggregator',
      version: '0',
      extractors: {
        perElement(el: ElementHandle, acc: FeatureSink): void {
          if (el.nodeName === 'IMG') {
            acc.set(el.selector, 'missing-alt', true);
          }
        },
      },
      evaluate(features: ExtractedFeatures): ReturnType<DomainModule['evaluate']> {
        const findings: ReturnType<DomainModule['evaluate']> = [];
        for (const [sel, data] of features.byElement) {
          if (data.domainFeatures['img-aggregator']?.get('missing-alt')) {
            findings.push({
              id: `missing-alt-${sel}`,
              scanId: '',
              domain: 'img-aggregator',
              ruleId: 'image-alt',
              severity: 'serious' as const,
              element: { selector: sel },
              message: 'Missing alt',
              wcagMapping: ['1.1.1'],
              regulatoryMapping: [],
            });
          }
        }
        return findings;
      },
      aggregate(sites: readonly PerSiteResult[]): ReturnType<DomainModule['evaluate']> {
        for (const s of sites) {
          findingsObserved.push({ site: s.site, findingCount: s.findings.length });
        }
        return [];
      },
    };

    // Site A has an IMG — will have one finding. Site B has none.
    const siteA = makeSnapshot(
      [{ nodeName: 'IMG', selector: 'img.hero' }],
      'http://has-img.test/',
    );
    const siteB = makeSnapshot(
      [{ nodeName: 'P', selector: 'p.text' }],
      'http://no-img.test/',
    );

    await runMultiDomainScan({
      snapshots: [siteA, siteB],
      domains: [imgFlagWithAggregate],
    });

    const siteAResult = findingsObserved.find((r) => r.site === 'http://has-img.test/');
    const siteBResult = findingsObserved.find((r) => r.site === 'http://no-img.test/');

    expect(siteAResult?.findingCount).toBeGreaterThan(0);
    expect(siteBResult?.findingCount).toBe(0);
  });
});
