// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Unit tests for the ai-readiness domain module.
//
// Invariants under test:
//   - perDocument extractor is pure and synchronous (returns void, no I/O).
//   - Positive cases: blocked AI crawler / missing llms.txt / missing JSON-LD
//     all produce the expected findings.
//   - Negative case: a fully-compliant snapshot (robots.txt allows all,
//     llms.txt present and valid, JSON-LD present and complete, body has text)
//     produces ZERO findings — proving a fully-compliant snapshot produces no false positives.
//   - Interaction-feature case: JS-only rendered page emits the
//     ai:rendering.js-only feature on the 'page' scope so the cross-domain
//     detector can pair it with the accessibility domain's equivalent feature.

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import type {
  CorrelatedFeature,
  ExtractedFeatures,
  FeatureSink,
  JoinScope,
  PropertySnapshot,
} from '../src/domain-contract.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_ROOT = join(
  __dirname,
  '../../ariada-test-fixtures/fixtures/domains/ai-readiness',
);
import {
  AI_LLMSTXT_NOAI_CONTRADICTION,
  AI_LLMSTXT_PRESENT,
  AI_LLMSTXT_VALID_STRUCTURE,
  AI_RENDERING_JS_ONLY,
  AI_ROBOTS_CRAWLER_BLOCKED,
  AI_ROBOTS_PRESENT,
  AI_SD_JSON_LD_PRESENT,
  aiReadinessDomain,
} from '../src/domains/ai-readiness.js';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/**
 * Minimal PropertySnapshot for the ai-readiness domain. The domain uses only
 * perDocument, so domOutline is empty. Caller supplies the fields the domain
 * actually reads: html, headers, originArtifacts.
 */
function makeSnap(opts: {
  html?: string;
  headers?: Record<string, string>;
  robotsTxt?: string;
  llmsTxt?: string;
  url?: string;
}): PropertySnapshot {
  const base: PropertySnapshot = {
    scanId: 'test-scan',
    url: opts.url ?? 'https://example.com/',
    timestamp: 0,
    html: opts.html ?? '<html><body><p>Hello world, this is a fully rendered page with plenty of text content that exceeds fifty characters.</p></body></html>',
    headers: opts.headers ?? {},
    cookies: [],
    networkResources: [],
    axTree: [],
    domOutline: [],
    perfMetrics: {},
    timings: { navigationMs: 0, axTreeMs: 0, domMs: 0, totalMs: 0 },
  };

  // Only attach originArtifacts when at least one artifact is provided.
  // exactOptionalPropertyTypes requires we omit the key rather than assign undefined.
  if (opts.robotsTxt !== undefined || opts.llmsTxt !== undefined) {
    base.originArtifacts = {
      ...(opts.robotsTxt !== undefined ? { robotsTxt: opts.robotsTxt } : {}),
      ...(opts.llmsTxt !== undefined ? { llmsTxt: opts.llmsTxt } : {}),
    };
  }

  return base;
}

/**
 * A FeatureSink implementation that stores features and builds an
 * ExtractedFeatures map that the evaluate() function can read, including the
 * byScope index the ai-readiness domain's evaluate() relies on.
 */
function makeSink(): FeatureSink & { toFeatures: () => ExtractedFeatures } {
  // byScope: scope → joinValue → CorrelatedFeature[]
  const scopeMap = new Map<JoinScope, Map<string, CorrelatedFeature[]>>();

  function ensureScopeEntry(scope: JoinScope, joinValue: string): CorrelatedFeature[] {
    if (!scopeMap.has(scope)) scopeMap.set(scope, new Map());
    const valueMap = scopeMap.get(scope)!;
    if (!valueMap.has(joinValue)) valueMap.set(joinValue, []);
    return valueMap.get(joinValue)!;
  }

  return {
    set(elementKey: string, featureKey: string, value: unknown): void {
      // element-scoped features also enter byScope under 'element'
      const arr = ensureScopeEntry('element', elementKey);
      arr.push({ domainId: 'ai-readiness', featureKey, value, scope: 'element', joinValue: elementKey });
    },
    setScoped(scope: JoinScope, joinValue: string, featureKey: string, value: unknown): void {
      const arr = ensureScopeEntry(scope, joinValue);
      arr.push({ domainId: 'ai-readiness', featureKey, value, scope, joinValue });
    },
    toFeatures(): ExtractedFeatures {
      return {
        byElement: new Map(),
        byDocument: new Map(),
        byScope: scopeMap,
      };
    },
  };
}

/**
 * Run the extractor on a snapshot and return the resulting ExtractedFeatures.
 */
function extractFrom(snap: PropertySnapshot): ExtractedFeatures {
  const sink = makeSink();
  aiReadinessDomain.extractors.perDocument!(snap, sink);
  return sink.toFeatures();
}

/**
 * Find a correlated feature by its key within a given scope and join value.
 */
function findFeature(
  features: ExtractedFeatures,
  scope: JoinScope,
  joinValue: string,
  featureKey: string,
): CorrelatedFeature | undefined {
  return features.byScope
    ?.get(scope)
    ?.get(joinValue)
    ?.find((f) => f.featureKey === featureKey);
}

// ---------------------------------------------------------------------------
// Extractor purity — perDocument returns void (sync contract)
// ---------------------------------------------------------------------------

describe('ai-readiness extractor purity', () => {
  it('perDocument returns undefined (sync, no Promise)', () => {
    const snap = makeSnap({});
    const sink = makeSink();
    const returnValue = aiReadinessDomain.extractors.perDocument!(snap, sink);
    // A sync extractor returns undefined; a Promise return would be an object.
    expect(returnValue).toBeUndefined();
  });

  it('extractor does not mutate the snapshot', () => {
    const snap = makeSnap({ robotsTxt: 'User-agent: *\nDisallow:\n' });
    const originalUrl = snap.url;
    const originalHtml = snap.html;
    extractFrom(snap);
    expect(snap.url).toBe(originalUrl);
    expect(snap.html).toBe(originalHtml);
  });

  it('extractor tolerates absent originArtifacts without throwing', () => {
    // originArtifacts is optional — the domain must handle its absence gracefully.
    const snap = makeSnap({});
    // snap has no originArtifacts (undefined)
    expect(snap.originArtifacts).toBeUndefined();
    expect(() => extractFrom(snap)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Positive case — blocked AI crawler produces a finding
// ---------------------------------------------------------------------------

describe('robots.txt checks — positive cases', () => {
  it('emits a crawler-blocked finding when GPTBot is disallowed', () => {
    const snap = makeSnap({
      robotsTxt: 'User-agent: GPTBot\nDisallow: /\n\nUser-agent: *\nDisallow:\n',
    });
    const features = extractFrom(snap);
    const findings = aiReadinessDomain.evaluate(features);

    const blocked = findings.find((f) => f.ruleId === 'ai-readiness/crawler-blocked');
    expect(blocked).toBeDefined();
    expect(blocked?.severity).toBe('serious');
    expect(blocked?.message).toContain('gptbot');
  });

  it('emits a robots-missing finding when robotsTxt artifact is absent', () => {
    // No originArtifacts at all — robots.txt cannot be read.
    const snap = makeSnap({});
    const features = extractFrom(snap);
    const findings = aiReadinessDomain.evaluate(features);

    const missing = findings.find((f) => f.ruleId === 'ai-readiness/robots-missing');
    expect(missing).toBeDefined();
    expect(missing?.severity).toBe('serious');
  });

  it('emits a crawl-delay-excessive finding when delay > 60 for an AI crawler', () => {
    const snap = makeSnap({
      robotsTxt: 'User-agent: GPTBot\nDisallow:\nCrawl-delay: 120\n',
    });
    const features = extractFrom(snap);
    const findings = aiReadinessDomain.evaluate(features);

    const delayFinding = findings.find((f) => f.ruleId === 'ai-readiness/crawl-delay-excessive');
    expect(delayFinding).toBeDefined();
    expect(delayFinding?.severity).toBe('moderate');
  });

  it('emits llmstxt-missing when llmsTxt artifact is absent', () => {
    const snap = makeSnap({ robotsTxt: 'User-agent: *\nDisallow:\n' });
    const features = extractFrom(snap);
    const findings = aiReadinessDomain.evaluate(features);

    const llmsMissing = findings.find((f) => f.ruleId === 'ai-readiness/llmstxt-missing');
    expect(llmsMissing).toBeDefined();
    expect(llmsMissing?.severity).toBe('moderate');
  });

  it('emits llmstxt-invalid-structure when llms.txt has no H1 or no URL', () => {
    const snap = makeSnap({
      robotsTxt: 'User-agent: *\nDisallow:\n',
      llmsTxt: 'This file has no heading and no URLs.\n',
    });
    const features = extractFrom(snap);
    const findings = aiReadinessDomain.evaluate(features);

    const invalid = findings.find((f) => f.ruleId === 'ai-readiness/llmstxt-invalid-structure');
    expect(invalid).toBeDefined();
    expect(invalid?.severity).toBe('moderate');
  });

  it('emits llmstxt-noai-contradiction when X-Robots-Tag: noai is present', () => {
    const snap = makeSnap({
      robotsTxt: 'User-agent: *\nDisallow:\n',
      llmsTxt: '# My Site\n\nhttps://example.com/docs\n',
      headers: { 'x-robots-tag': 'noai' },
    });
    const features = extractFrom(snap);
    const findings = aiReadinessDomain.evaluate(features);

    const contradiction = findings.find((f) => f.ruleId === 'ai-readiness/llmstxt-noai-contradiction');
    expect(contradiction).toBeDefined();
    expect(contradiction?.severity).toBe('moderate');
  });

  it('emits no-json-ld when no JSON-LD block is present in HTML', () => {
    const snap = makeSnap({
      html: '<html><body><p>No structured data here at all, just plain text content.</p></body></html>',
    });
    const features = extractFrom(snap);
    const findings = aiReadinessDomain.evaluate(features);

    const noJsonLd = findings.find((f) => f.ruleId === 'ai-readiness/no-json-ld');
    expect(noJsonLd).toBeDefined();
    expect(noJsonLd?.severity).toBe('minor');
  });

  it('emits json-ld-missing-required-prop when a required property is absent', () => {
    // Organization requires name and url; omit url
    const jsonLd = JSON.stringify({ '@type': 'Organization', name: 'Example Corp' });
    const snap = makeSnap({
      html: `<html><body><p>Some text content that is long enough to avoid the js-only detection threshold.</p><script type="application/ld+json">${jsonLd}</script></body></html>`,
    });
    const features = extractFrom(snap);
    const findings = aiReadinessDomain.evaluate(features);

    const missingProp = findings.find((f) => f.ruleId === 'ai-readiness/json-ld-missing-required-prop');
    expect(missingProp).toBeDefined();
    expect(missingProp?.severity).toBe('serious');
    expect(missingProp?.message).toContain('url');
  });

  it('emits js-only-render finding when body text is below threshold', () => {
    // A page where the body has no meaningful text — simulates a JS-injected SPA shell
    const snap = makeSnap({
      html: '<html><body><div id="root"></div></body></html>',
    });
    const features = extractFrom(snap);
    const findings = aiReadinessDomain.evaluate(features);

    const jsOnly = findings.find((f) => f.ruleId === 'ai-readiness/js-only-render');
    expect(jsOnly).toBeDefined();
    expect(jsOnly?.severity).toBe('serious');
  });
});

// ---------------------------------------------------------------------------
// Negative case — clean snapshot produces NO findings (false-positive guard)
// ---------------------------------------------------------------------------

describe('ai-readiness clean snapshot — no findings', () => {
  it('produces zero findings when all checks pass', () => {
    // robots.txt: allows all AI crawlers, no excessive crawl-delay
    const robotsTxt = [
      'User-agent: GPTBot',
      'Allow: /',
      '',
      'User-agent: ClaudeBot',
      'Allow: /',
      '',
      'User-agent: *',
      'Disallow:',
    ].join('\n');

    // llms.txt: starts with H1, contains a URL
    const llmsTxt = '# Example Site\n\nThis site provides documentation.\n\nhttps://example.com/docs\n';

    // JSON-LD: Organization with required fields name and url
    const jsonLd = JSON.stringify({ '@type': 'Organization', name: 'Example Corp', url: 'https://example.com' });

    // HTML: server-rendered body with plenty of text
    const html = [
      '<html>',
      '<head>',
      `<script type="application/ld+json">${jsonLd}</script>`,
      '</head>',
      '<body>',
      '<h1>Welcome to Example Corp</h1>',
      '<p>We provide enterprise compliance scanning software for European markets. Our platform covers accessibility, privacy, and security in one scan.</p>',
      '<nav><a href="/docs">Documentation</a><a href="/about">About</a></nav>',
      '</body>',
      '</html>',
    ].join('\n');

    const snap = makeSnap({ robotsTxt, llmsTxt, html });
    const features = extractFrom(snap);
    const findings = aiReadinessDomain.evaluate(features);

    // A fully compliant site must produce zero findings.
    expect(findings).toHaveLength(0);
  });

  it('does not flag a well-formed JSON-LD Organization block', () => {
    const jsonLd = JSON.stringify({ '@type': 'Organization', name: 'Acme', url: 'https://acme.com' });
    const html = `<html><body><p>A server-rendered page with enough text to avoid the JS-only rendering detection threshold comfortably.</p><script type="application/ld+json">${jsonLd}</script></body></html>`;
    const snap = makeSnap({ html });
    const features = extractFrom(snap);
    const findings = aiReadinessDomain.evaluate(features);

    const jsonLdFindings = findings.filter(
      (f) => f.ruleId === 'ai-readiness/no-json-ld' || f.ruleId === 'ai-readiness/json-ld-missing-required-prop',
    );
    expect(jsonLdFindings).toHaveLength(0);
  });

  it('does not flag a valid llms.txt with H1 and a URL', () => {
    const snap = makeSnap({
      robotsTxt: 'User-agent: *\nDisallow:\n',
      llmsTxt: '# My Product Docs\n\nhttps://example.com/docs\nhttps://example.com/api\n',
    });
    const features = extractFrom(snap);
    const findings = aiReadinessDomain.evaluate(features);

    const llmsFindings = findings.filter((f) => f.ruleId.startsWith('ai-readiness/llmstxt-'));
    expect(llmsFindings).toHaveLength(0);
  });

  it('does not flag a body with sufficient text as JS-only rendered', () => {
    const html = '<html><body><main><h1>About us</h1><p>We are a company that builds compliance tools for European markets. Our product helps teams manage WCAG and EAA obligations efficiently.</p></main></body></html>';
    const snap = makeSnap({ html });
    const features = extractFrom(snap);
    const findings = aiReadinessDomain.evaluate(features);

    const jsOnlyFindings = findings.filter((f) => f.ruleId === 'ai-readiness/js-only-render');
    expect(jsOnlyFindings).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Interaction-feature case — JS-only rendering emits the right scoped feature
// ---------------------------------------------------------------------------

describe('ai-readiness interaction features', () => {
  it('emits ai:rendering.js-only on the page scope for a JS-only page', () => {
    const url = 'https://spa.example.com/';
    const snap = makeSnap({
      url,
      html: '<html><body><div id="root"></div></body></html>',
    });
    const sink = makeSink();
    aiReadinessDomain.extractors.perDocument!(snap, sink);
    const features = sink.toFeatures();

    const feature = findFeature(features, 'page', url, AI_RENDERING_JS_ONLY);
    expect(feature).toBeDefined();
    expect(feature?.value).toBe(true);
    expect(feature?.scope).toBe('page');
    expect(feature?.joinValue).toBe(url);
  });

  it('does not emit ai:rendering.js-only on the page scope for a server-rendered page', () => {
    const url = 'https://ssr.example.com/';
    const snap = makeSnap({
      url,
      html: '<html><body><main><h1>Real content</h1><p>This is a fully server-side rendered page with substantial text content that clearly exceeds the fifty character threshold used for JS-only detection.</p></main></body></html>',
    });
    const sink = makeSink();
    aiReadinessDomain.extractors.perDocument!(snap, sink);
    const features = sink.toFeatures();

    const feature = findFeature(features, 'page', url, AI_RENDERING_JS_ONLY);
    // Either absent or explicitly false
    expect(feature?.value !== true).toBe(true);
  });

  it('interactionFeatures declares ai:rendering.js-only on the page scope', () => {
    const spec = aiReadinessDomain.interactionFeatures?.find(
      (f) => f.key === AI_RENDERING_JS_ONLY,
    );
    expect(spec).toBeDefined();
    expect(spec?.joinScope).toBe('page');
  });

  it('interactionFeatures declares ai:robots.crawler-blocked on the origin scope', () => {
    const spec = aiReadinessDomain.interactionFeatures?.find(
      (f) => f.key === AI_ROBOTS_CRAWLER_BLOCKED,
    );
    expect(spec).toBeDefined();
    expect(spec?.joinScope).toBe('origin');
  });

  it('interactionFeatures declares ai:sd.json-ld-present on the document scope', () => {
    const spec = aiReadinessDomain.interactionFeatures?.find(
      (f) => f.key === AI_SD_JSON_LD_PRESENT,
    );
    expect(spec).toBeDefined();
    expect(spec?.joinScope).toBe('document');
  });

  it('emits origin-scoped feature with the page origin as join value', () => {
    const url = 'https://blocked.example.com/page';
    const snap = makeSnap({
      url,
      robotsTxt: 'User-agent: GPTBot\nDisallow: /\n',
    });
    const sink = makeSink();
    aiReadinessDomain.extractors.perDocument!(snap, sink);
    const features = sink.toFeatures();

    // The origin join value must be the scheme+host, not the full path
    const originJoinValue = 'https://blocked.example.com';
    const feature = findFeature(features, 'origin', originJoinValue, AI_ROBOTS_CRAWLER_BLOCKED);
    expect(feature).toBeDefined();
    expect(feature?.value).toBe(true);
    expect(feature?.scope).toBe('origin');
  });
});

// ---------------------------------------------------------------------------
// DomainModule shape and metadata
// ---------------------------------------------------------------------------

describe('ai-readiness domain module contract', () => {
  it('has the required id, title, version fields', () => {
    expect(aiReadinessDomain.id).toBe('ai-readiness');
    expect(aiReadinessDomain.title).toBe('AI Readiness');
    expect(typeof aiReadinessDomain.version).toBe('string');
  });

  it('has a perDocument extractor and no perElement extractor', () => {
    // All checks in this domain are document-level; no element iteration needed.
    expect(typeof aiReadinessDomain.extractors.perDocument).toBe('function');
    expect(aiReadinessDomain.extractors.perElement).toBeUndefined();
  });

  it('has a non-empty interactionFeatures array', () => {
    expect(aiReadinessDomain.interactionFeatures).toBeDefined();
    expect((aiReadinessDomain.interactionFeatures ?? []).length).toBeGreaterThan(0);
  });

  it('every interactionFeature entry has a key, description, and joinScope', () => {
    for (const spec of aiReadinessDomain.interactionFeatures ?? []) {
      expect(typeof spec.key).toBe('string');
      expect(spec.key.length).toBeGreaterThan(0);
      expect(typeof spec.description).toBe('string');
      expect(spec.description.length).toBeGreaterThan(0);
      expect(['element', 'document', 'cookie', 'request', 'origin', 'page']).toContain(spec.joinScope);
    }
  });

  it('evaluate returns an array (even on empty features)', () => {
    const empty: ExtractedFeatures = {
      byElement: new Map(),
      byDocument: new Map(),
    };
    const result = aiReadinessDomain.evaluate(empty);
    expect(Array.isArray(result)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Feature key exports are correct strings (regression guard)
// ---------------------------------------------------------------------------

describe('exported feature key constants', () => {
  it('AI_ROBOTS_PRESENT has expected value', () => {
    expect(AI_ROBOTS_PRESENT).toBe('ai:robots.present');
  });

  it('AI_ROBOTS_CRAWLER_BLOCKED has expected value', () => {
    expect(AI_ROBOTS_CRAWLER_BLOCKED).toBe('ai:robots.crawler-blocked');
  });

  it('AI_LLMSTXT_PRESENT has expected value', () => {
    expect(AI_LLMSTXT_PRESENT).toBe('ai:llmstxt.present');
  });

  it('AI_LLMSTXT_VALID_STRUCTURE has expected value', () => {
    expect(AI_LLMSTXT_VALID_STRUCTURE).toBe('ai:llmstxt.valid-structure');
  });

  it('AI_LLMSTXT_NOAI_CONTRADICTION has expected value', () => {
    expect(AI_LLMSTXT_NOAI_CONTRADICTION).toBe('ai:llmstxt.noai-contradiction');
  });

  it('AI_SD_JSON_LD_PRESENT has expected value', () => {
    expect(AI_SD_JSON_LD_PRESENT).toBe('ai:sd.json-ld-present');
  });

  it('AI_RENDERING_JS_ONLY has expected value', () => {
    expect(AI_RENDERING_JS_ONLY).toBe('ai:rendering.js-only');
  });
});

// ---------------------------------------------------------------------------
// Fixture-coverage harness — mirrors the accessibility.test.ts pattern.
//
// For ai-readiness, most rules read from PropertySnapshot.originArtifacts
// (robotsTxt / llmsTxt) rather than from page HTML alone. Each fixture case
// is therefore described by the HTML comments inside the fixture file, which
// specify the exact originArtifacts content required. The tests below replicate
// that configuration from the documented fixture intent.
// ---------------------------------------------------------------------------

/**
 * Load the raw HTML from a fixture folder (used as the PropertySnapshot.html
 * so the domain receives a realistic document without additional fetches).
 */
function loadFixtureHtml(ruleDir: string): string {
  return readFileSync(join(FIXTURES_ROOT, ruleDir, `${ruleDir}.html`), 'utf8');
}

/**
 * Build a PropertySnapshot for a fixture case, combining the fixture HTML with
 * the originArtifacts content the fixture documents for that case.
 */
function makeFixtureSnap(opts: {
  ruleDir: string;
  robotsTxt?: string;
  llmsTxt?: string;
  headers?: Record<string, string>;
  url?: string;
}): PropertySnapshot {
  const html = loadFixtureHtml(opts.ruleDir);
  const base: PropertySnapshot = {
    scanId: `fixture-${opts.ruleDir}`,
    url: opts.url ?? 'https://example.com/',
    timestamp: 0,
    html,
    headers: opts.headers ?? {},
    cookies: [],
    networkResources: [],
    axTree: [],
    domOutline: [],
    perfMetrics: {},
    timings: { navigationMs: 0, axTreeMs: 0, domMs: 0, totalMs: 0 },
  };

  if (opts.robotsTxt !== undefined || opts.llmsTxt !== undefined) {
    base.originArtifacts = {
      ...(opts.robotsTxt !== undefined ? { robotsTxt: opts.robotsTxt } : {}),
      ...(opts.llmsTxt !== undefined ? { llmsTxt: opts.llmsTxt } : {}),
    };
  }

  return base;
}

/**
 * Run extractors + evaluate for a fixture snapshot and return findings grouped
 * by ruleId.
 */
function runFixture(snap: PropertySnapshot): Map<string, ReturnType<typeof aiReadinessDomain.evaluate>> {
  const sink = makeSink();
  aiReadinessDomain.extractors.perDocument!(snap, sink);
  const findings = aiReadinessDomain.evaluate(sink.toFeatures());
  const byRule = new Map<string, typeof findings>();
  for (const f of findings) {
    if (!byRule.has(f.ruleId)) byRule.set(f.ruleId, []);
    byRule.get(f.ruleId)!.push(f);
  }
  return byRule;
}

// ---------------------------------------------------------------------------
// Fixture: robots-missing
//   fail-1: originArtifacts.robotsTxt = "" (absent)
//   pass-1: originArtifacts.robotsTxt = "User-agent: *\nAllow: /"
// ---------------------------------------------------------------------------

describe('fixture: ai-readiness/robots-missing', () => {
  it('fail-1: missing robotsTxt emits robots-missing finding at serious', () => {
    const snap = makeFixtureSnap({
      ruleDir: 'robots-missing',
      robotsTxt: '',
      llmsTxt: '# Site\nhttps://example.com/docs',
    });
    const byRule = runFixture(snap);
    expect(byRule.has('ai-readiness/robots-missing')).toBe(true);
    expect(byRule.get('ai-readiness/robots-missing')?.[0]?.severity).toBe('serious');
  });

  it('pass-1: present robotsTxt produces no robots-missing finding', () => {
    const snap = makeFixtureSnap({
      ruleDir: 'robots-missing',
      robotsTxt: 'User-agent: *\nAllow: /',
      llmsTxt: '# Site\nhttps://example.com/docs',
    });
    const byRule = runFixture(snap);
    expect(byRule.has('ai-readiness/robots-missing')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Fixture: crawler-blocked
//   fail-1: GPTBot and ClaudeBot explicitly Disallow: /
//   fail-2: wildcard Disallow: / blocks all AI crawlers
//   pass-1: wildcard Allow: / — no blocked crawlers
// ---------------------------------------------------------------------------

describe('fixture: ai-readiness/crawler-blocked', () => {
  it('fail-1: named GPTBot and ClaudeBot Disallow: / fires crawler-blocked at serious', () => {
    const snap = makeFixtureSnap({
      ruleDir: 'crawler-blocked',
      robotsTxt: 'User-agent: GPTBot\nDisallow: /\n\nUser-agent: ClaudeBot\nDisallow: /\n\nUser-agent: *\nAllow: /',
      llmsTxt: '# Site\nhttps://example.com/docs',
    });
    const byRule = runFixture(snap);
    expect(byRule.has('ai-readiness/crawler-blocked')).toBe(true);
    expect(byRule.get('ai-readiness/crawler-blocked')?.[0]?.severity).toBe('serious');
  });

  it('fail-2: catch-all Disallow: / blocks all AI crawlers — fires crawler-blocked at serious', () => {
    const snap = makeFixtureSnap({
      ruleDir: 'crawler-blocked',
      robotsTxt: 'User-agent: *\nDisallow: /',
      llmsTxt: '# Site\nhttps://example.com/docs',
    });
    const byRule = runFixture(snap);
    expect(byRule.has('ai-readiness/crawler-blocked')).toBe(true);
    expect(byRule.get('ai-readiness/crawler-blocked')?.[0]?.severity).toBe('serious');
  });

  it('pass-1: wildcard Allow: / produces no crawler-blocked finding', () => {
    const snap = makeFixtureSnap({
      ruleDir: 'crawler-blocked',
      robotsTxt: 'User-agent: *\nAllow: /',
      llmsTxt: '# Site\nhttps://example.com/docs',
    });
    const byRule = runFixture(snap);
    expect(byRule.has('ai-readiness/crawler-blocked')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Fixture: crawl-delay-excessive
//   fail-1: GPTBot stanza has Crawl-delay: 300 (> 60)
//   fail-2: wildcard stanza has Crawl-delay: 86400 (> 60)
//   pass-1: wildcard stanza has Crawl-delay: 10 (<= 60)
// ---------------------------------------------------------------------------

describe('fixture: ai-readiness/crawl-delay-excessive', () => {
  it('fail-1: GPTBot Crawl-delay: 300 fires crawl-delay-excessive at moderate', () => {
    const snap = makeFixtureSnap({
      ruleDir: 'crawl-delay-excessive',
      robotsTxt: 'User-agent: GPTBot\nCrawl-delay: 300\nAllow: /\n\nUser-agent: *\nAllow: /',
      llmsTxt: '# Site\nhttps://example.com/docs',
    });
    const byRule = runFixture(snap);
    expect(byRule.has('ai-readiness/crawl-delay-excessive')).toBe(true);
    expect(byRule.get('ai-readiness/crawl-delay-excessive')?.[0]?.severity).toBe('moderate');
  });

  it('fail-2: wildcard Crawl-delay: 86400 fires crawl-delay-excessive at moderate', () => {
    const snap = makeFixtureSnap({
      ruleDir: 'crawl-delay-excessive',
      robotsTxt: 'User-agent: *\nCrawl-delay: 86400\nAllow: /',
      llmsTxt: '# Site\nhttps://example.com/docs',
    });
    const byRule = runFixture(snap);
    expect(byRule.has('ai-readiness/crawl-delay-excessive')).toBe(true);
    expect(byRule.get('ai-readiness/crawl-delay-excessive')?.[0]?.severity).toBe('moderate');
  });

  it('pass-1: Crawl-delay: 10 is within threshold — no crawl-delay-excessive finding', () => {
    const snap = makeFixtureSnap({
      ruleDir: 'crawl-delay-excessive',
      robotsTxt: 'User-agent: *\nCrawl-delay: 10\nAllow: /',
      llmsTxt: '# Site\nhttps://example.com/docs',
    });
    const byRule = runFixture(snap);
    expect(byRule.has('ai-readiness/crawl-delay-excessive')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Fixture: llmstxt-missing
//   fail-1: llmsTxt = "" (absent)
//   pass-1: llmsTxt = valid content with H1 and URL
// ---------------------------------------------------------------------------

describe('fixture: ai-readiness/llmstxt-missing', () => {
  it('fail-1: empty llmsTxt emits llmstxt-missing at moderate', () => {
    const snap = makeFixtureSnap({
      ruleDir: 'llmstxt-missing',
      robotsTxt: 'User-agent: *\nAllow: /',
      llmsTxt: '',
    });
    const byRule = runFixture(snap);
    expect(byRule.has('ai-readiness/llmstxt-missing')).toBe(true);
    expect(byRule.get('ai-readiness/llmstxt-missing')?.[0]?.severity).toBe('moderate');
  });

  it('pass-1: valid llmsTxt with H1 and URL produces no llmstxt-missing finding', () => {
    const snap = makeFixtureSnap({
      ruleDir: 'llmstxt-missing',
      robotsTxt: 'User-agent: *\nAllow: /',
      llmsTxt: '# My Site\n> This site provides product documentation for developers.\n## Full content\n- https://example.com/docs: Full documentation',
    });
    const byRule = runFixture(snap);
    expect(byRule.has('ai-readiness/llmstxt-missing')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Fixture: llmstxt-invalid-structure
//   fail-1: no H1, no URL
//   fail-2: has H1 but no URL
//   fail-3: has URL but no H1
//   pass-1: has H1 and URL
// ---------------------------------------------------------------------------

describe('fixture: ai-readiness/llmstxt-invalid-structure', () => {
  it('fail-1: no H1 and no URL fires llmstxt-invalid-structure at moderate', () => {
    const snap = makeFixtureSnap({
      ruleDir: 'llmstxt-invalid-structure',
      robotsTxt: 'User-agent: *\nAllow: /',
      llmsTxt: 'This site allows AI access. See documentation for details.\nContact: admin@example.com',
    });
    const byRule = runFixture(snap);
    expect(byRule.has('ai-readiness/llmstxt-invalid-structure')).toBe(true);
    expect(byRule.get('ai-readiness/llmstxt-invalid-structure')?.[0]?.severity).toBe('moderate');
  });

  it('fail-2: H1 but no URL fires llmstxt-invalid-structure at moderate', () => {
    const snap = makeFixtureSnap({
      ruleDir: 'llmstxt-invalid-structure',
      robotsTxt: 'User-agent: *\nAllow: /',
      llmsTxt: '# My Company Docs\nThis site provides product information for LLM agents.\nPlease read only public documentation.',
    });
    const byRule = runFixture(snap);
    expect(byRule.has('ai-readiness/llmstxt-invalid-structure')).toBe(true);
    expect(byRule.get('ai-readiness/llmstxt-invalid-structure')?.[0]?.severity).toBe('moderate');
  });

  it('fail-3: URL but no H1 fires llmstxt-invalid-structure at moderate', () => {
    const snap = makeFixtureSnap({
      ruleDir: 'llmstxt-invalid-structure',
      robotsTxt: 'User-agent: *\nAllow: /',
      llmsTxt: 'LLM access allowed for the following pages:\nhttps://example.com/docs\nhttps://example.com/api',
    });
    const byRule = runFixture(snap);
    expect(byRule.has('ai-readiness/llmstxt-invalid-structure')).toBe(true);
    expect(byRule.get('ai-readiness/llmstxt-invalid-structure')?.[0]?.severity).toBe('moderate');
  });

  it('pass-1: H1 and URL present produces no llmstxt-invalid-structure finding', () => {
    const snap = makeFixtureSnap({
      ruleDir: 'llmstxt-invalid-structure',
      robotsTxt: 'User-agent: *\nAllow: /',
      llmsTxt: '# Example Site\n> This site provides documentation for developers.\n## Docs\n- https://example.com/docs: Full API documentation',
    });
    const byRule = runFixture(snap);
    expect(byRule.has('ai-readiness/llmstxt-invalid-structure')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Fixture: llmstxt-noai-contradiction
//   fail-1: llmsTxt present + X-Robots-Tag: noai
//   fail-2: llmsTxt present + X-Robots-Tag: noindex, noai
//   pass-1: llmsTxt present + X-Robots-Tag: nosnippet (no contradiction)
// ---------------------------------------------------------------------------

describe('fixture: ai-readiness/llmstxt-noai-contradiction', () => {
  const validLlmsTxt = '# Example Site\n> LLM agents may read and cite content from this site.\n## Docs\n- https://example.com/docs: Documentation';

  it('fail-1: X-Robots-Tag: noai contradicts llmsTxt — fires at moderate', () => {
    const snap = makeFixtureSnap({
      ruleDir: 'llmstxt-noai-contradiction',
      robotsTxt: 'User-agent: *\nAllow: /',
      llmsTxt: validLlmsTxt,
      headers: { 'x-robots-tag': 'noai' },
    });
    const byRule = runFixture(snap);
    expect(byRule.has('ai-readiness/llmstxt-noai-contradiction')).toBe(true);
    expect(byRule.get('ai-readiness/llmstxt-noai-contradiction')?.[0]?.severity).toBe('moderate');
  });

  it('fail-2: X-Robots-Tag: noindex, noai contradicts llmsTxt — fires at moderate', () => {
    const snap = makeFixtureSnap({
      ruleDir: 'llmstxt-noai-contradiction',
      robotsTxt: 'User-agent: *\nAllow: /',
      llmsTxt: '# Example Site\n- https://example.com/docs: Documentation',
      headers: { 'x-robots-tag': 'noindex, noai' },
    });
    const byRule = runFixture(snap);
    expect(byRule.has('ai-readiness/llmstxt-noai-contradiction')).toBe(true);
    expect(byRule.get('ai-readiness/llmstxt-noai-contradiction')?.[0]?.severity).toBe('moderate');
  });

  it('pass-1: X-Robots-Tag: nosnippet does not contradict llmsTxt — no finding', () => {
    const snap = makeFixtureSnap({
      ruleDir: 'llmstxt-noai-contradiction',
      robotsTxt: 'User-agent: *\nAllow: /',
      llmsTxt: validLlmsTxt,
      headers: { 'x-robots-tag': 'nosnippet' },
    });
    const byRule = runFixture(snap);
    expect(byRule.has('ai-readiness/llmstxt-noai-contradiction')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Fixture: no-json-ld
//   fail-1: page has no JSON-LD script block at all
//   fail-2: page has script type="text/javascript" — NOT matched by regex
//   pass-1: page has valid application/ld+json block
//
// Note: the fixture HTML already contains the page content for each case
// embedded in the document. We load the whole fixture HTML and verify the
// domain correctly detects the presence/absence of JSON-LD.
// ---------------------------------------------------------------------------

describe('fixture: ai-readiness/no-json-ld', () => {
  it('fail-1: page with no JSON-LD block fires no-json-ld at minor', () => {
    // Construct a snapshot that represents a page with no JSON-LD at all
    const snap = makeFixtureSnap({
      ruleDir: 'no-json-ld',
      robotsTxt: 'User-agent: *\nAllow: /',
      llmsTxt: '# Site\nhttps://example.com/docs',
      url: 'https://example.com/fail-1',
    });
    // Override html to a page with no JSON-LD
    snap.html = '<html><head><title>Product page</title></head><body><h1>Product documentation page</h1><p>This page describes our product features and pricing. It contains no JSON-LD structured data block, so AI citation engines cannot extract machine-readable metadata about the content or its authorship.</p></body></html>';
    const byRule = runFixture(snap);
    expect(byRule.has('ai-readiness/no-json-ld')).toBe(true);
    expect(byRule.get('ai-readiness/no-json-ld')?.[0]?.severity).toBe('minor');
  });

  it('fail-2: page with only text/javascript script (no JSON-LD) fires no-json-ld at minor', () => {
    const snap = makeFixtureSnap({
      ruleDir: 'no-json-ld',
      robotsTxt: 'User-agent: *\nAllow: /',
      llmsTxt: '# Site\nhttps://example.com/docs',
      url: 'https://example.com/fail-2',
    });
    snap.html = '<html><head><title>Page</title><script type="text/javascript">var pageId = "docs-feature-a";</script></head><body><h1>Page with non-JSON-LD script only</h1><p>The JavaScript above uses type text/javascript — the JSON-LD detector requires the exact MIME type application/ld+json and ignores this script.</p></body></html>';
    const byRule = runFixture(snap);
    expect(byRule.has('ai-readiness/no-json-ld')).toBe(true);
    expect(byRule.get('ai-readiness/no-json-ld')?.[0]?.severity).toBe('minor');
  });

  it('pass-1: page with valid application/ld+json block produces no no-json-ld finding', () => {
    const snap = makeFixtureSnap({
      ruleDir: 'no-json-ld',
      robotsTxt: 'User-agent: *\nAllow: /',
      llmsTxt: '# Site\nhttps://example.com/docs',
      url: 'https://example.com/pass-1',
    });
    snap.html = '<html><head><script type="application/ld+json">{"@context":"https://schema.org","@type":"WebPage","name":"Control page","url":"https://example.com/pass"}</script></head><body><p>Control page with valid JSON-LD.</p></body></html>';
    const byRule = runFixture(snap);
    expect(byRule.has('ai-readiness/no-json-ld')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Fixture: json-ld-missing-required-prop
//   fail-1: Organization missing required "url"
//   fail-2: Article missing "author" and "datePublished" (two findings)
//   fail-3: Product with empty "name" (treated as missing)
//   pass-1: Organization with name and url present
//   pass-2: Article with all three required props
// ---------------------------------------------------------------------------

describe('fixture: ai-readiness/json-ld-missing-required-prop', () => {
  const BODY_TEXT = '<p>This page has enough body text to avoid triggering the js-only-render rule.</p>';

  it('fail-1: Organization missing required url fires json-ld-missing-required-prop at serious', () => {
    const snap = makeFixtureSnap({
      ruleDir: 'json-ld-missing-required-prop',
      robotsTxt: 'User-agent: *\nAllow: /',
      llmsTxt: '# Site\nhttps://example.com/docs',
      url: 'https://example.com/fail-1',
    });
    snap.html = `<html><head><script type="application/ld+json">{"@context":"https://schema.org","@type":"Organization","name":"Example Corp"}</script></head><body>${BODY_TEXT}</body></html>`;
    const byRule = runFixture(snap);
    expect(byRule.has('ai-readiness/json-ld-missing-required-prop')).toBe(true);
    const findings = byRule.get('ai-readiness/json-ld-missing-required-prop') ?? [];
    expect(findings[0]?.severity).toBe('serious');
    expect(findings.some((f) => f.message.includes('url'))).toBe(true);
  });

  it('fail-2: Article missing author and datePublished fires two json-ld-missing-required-prop findings', () => {
    const snap = makeFixtureSnap({
      ruleDir: 'json-ld-missing-required-prop',
      robotsTxt: 'User-agent: *\nAllow: /',
      llmsTxt: '# Site\nhttps://example.com/docs',
      url: 'https://example.com/fail-2',
    });
    snap.html = `<html><head><script type="application/ld+json">{"@context":"https://schema.org","@type":"Article","headline":"Understanding AI Readiness"}</script></head><body>${BODY_TEXT}</body></html>`;
    const byRule = runFixture(snap);
    expect(byRule.has('ai-readiness/json-ld-missing-required-prop')).toBe(true);
    const findings = byRule.get('ai-readiness/json-ld-missing-required-prop') ?? [];
    expect(findings.length).toBeGreaterThanOrEqual(2);
    expect(findings.every((f) => f.severity === 'serious')).toBe(true);
  });

  it('fail-3: Product with empty name fires json-ld-missing-required-prop at serious', () => {
    const snap = makeFixtureSnap({
      ruleDir: 'json-ld-missing-required-prop',
      robotsTxt: 'User-agent: *\nAllow: /',
      llmsTxt: '# Site\nhttps://example.com/docs',
      url: 'https://example.com/fail-3',
    });
    snap.html = `<html><head><script type="application/ld+json">{"@context":"https://schema.org","@type":"Product","name":"","description":"A SaaS product"}</script></head><body>${BODY_TEXT}</body></html>`;
    const byRule = runFixture(snap);
    expect(byRule.has('ai-readiness/json-ld-missing-required-prop')).toBe(true);
    expect(byRule.get('ai-readiness/json-ld-missing-required-prop')?.[0]?.severity).toBe('serious');
  });

  it('pass-1: Organization with name and url present produces no json-ld-missing-required-prop finding', () => {
    const snap = makeFixtureSnap({
      ruleDir: 'json-ld-missing-required-prop',
      robotsTxt: 'User-agent: *\nAllow: /',
      llmsTxt: '# Site\nhttps://example.com/docs',
      url: 'https://example.com/pass-1',
    });
    snap.html = `<html><head><script type="application/ld+json">{"@context":"https://schema.org","@type":"Organization","name":"Agonist Development AB","url":"https://ariada.org"}</script></head><body>${BODY_TEXT}</body></html>`;
    const byRule = runFixture(snap);
    expect(byRule.has('ai-readiness/json-ld-missing-required-prop')).toBe(false);
  });

  it('pass-2: Article with all required props produces no json-ld-missing-required-prop finding', () => {
    const snap = makeFixtureSnap({
      ruleDir: 'json-ld-missing-required-prop',
      robotsTxt: 'User-agent: *\nAllow: /',
      llmsTxt: '# Site\nhttps://example.com/docs',
      url: 'https://example.com/pass-2',
    });
    snap.html = `<html><head><script type="application/ld+json">{"@context":"https://schema.org","@type":"Article","headline":"Getting Started","author":{"@type":"Person","name":"Alexander Brichkin"},"datePublished":"2026-06-01"}</script></head><body>${BODY_TEXT}</body></html>`;
    const byRule = runFixture(snap);
    expect(byRule.has('ai-readiness/json-ld-missing-required-prop')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Fixture: js-only-render
//   fail-1: body is <div id="root"></div> — text length 0 < 50 threshold
//   fail-2: body is <div id="app">Loading...</div> — text "Loading..." (10 chars)
//   fail-3: body is <noscript>Please enable JavaScript.</noscript> — 25 chars
//   pass-1: body has server-rendered heading + paragraph — well over 50 chars
// ---------------------------------------------------------------------------

describe('fixture: ai-readiness/js-only-render', () => {
  it('fail-1: empty SPA mount point body fires js-only-render at serious', () => {
    const snap = makeFixtureSnap({
      ruleDir: 'js-only-render',
      robotsTxt: 'User-agent: *\nAllow: /',
      llmsTxt: '# Site\nhttps://example.com/docs',
      url: 'https://example.com/fail-1',
    });
    snap.html = '<html><head><title>App</title></head><body><div id="root"></div></body></html>';
    const byRule = runFixture(snap);
    expect(byRule.has('ai-readiness/js-only-render')).toBe(true);
    expect(byRule.get('ai-readiness/js-only-render')?.[0]?.severity).toBe('serious');
  });

  it('fail-2: body with only "Loading..." text (10 chars) fires js-only-render at serious', () => {
    const snap = makeFixtureSnap({
      ruleDir: 'js-only-render',
      robotsTxt: 'User-agent: *\nAllow: /',
      llmsTxt: '# Site\nhttps://example.com/docs',
      url: 'https://example.com/fail-2',
    });
    snap.html = '<html><head><title>App</title></head><body><div id="app">Loading...</div></body></html>';
    const byRule = runFixture(snap);
    expect(byRule.has('ai-readiness/js-only-render')).toBe(true);
    expect(byRule.get('ai-readiness/js-only-render')?.[0]?.severity).toBe('serious');
  });

  it('fail-3: body with only noscript message (25 chars) fires js-only-render at serious', () => {
    const snap = makeFixtureSnap({
      ruleDir: 'js-only-render',
      robotsTxt: 'User-agent: *\nAllow: /',
      llmsTxt: '# Site\nhttps://example.com/docs',
      url: 'https://example.com/fail-3',
    });
    snap.html = '<html><head><title>App</title></head><body><noscript>Please enable JavaScript.</noscript></body></html>';
    const byRule = runFixture(snap);
    expect(byRule.has('ai-readiness/js-only-render')).toBe(true);
    expect(byRule.get('ai-readiness/js-only-render')?.[0]?.severity).toBe('serious');
  });

  it('pass-1: server-rendered body with substantial text produces no js-only-render finding', () => {
    const snap = makeFixtureSnap({
      ruleDir: 'js-only-render',
      robotsTxt: 'User-agent: *\nAllow: /',
      llmsTxt: '# Site\nhttps://example.com/docs',
      url: 'https://example.com/pass-1',
    });
    snap.html = '<html><head><title>App</title></head><body><header><h1>Web Accessibility Scanner</h1><nav><a href="/scan">Scan</a></nav></header><main><p>Check your site now. Our scanner detects WCAG 2.2 and EAA issues automatically.</p></main></body></html>';
    const byRule = runFixture(snap);
    expect(byRule.has('ai-readiness/js-only-render')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Fixture: clean-page guard
// A fully-compliant snapshot produces zero ai-readiness findings — guards against
// false positives across the entire rule set.
// ---------------------------------------------------------------------------

describe('fixture: ai-readiness clean-page false-positive guard', () => {
  it('fully-compliant snapshot produces zero ai-readiness findings', () => {
    const robotsTxt = 'User-agent: GPTBot\nAllow: /\n\nUser-agent: ClaudeBot\nAllow: /\n\nUser-agent: *\nDisallow:';
    const llmsTxt = '# My Site\n> LLM agents may read and cite content from this site.\n## Docs\n- https://example.com/docs: Full documentation';
    const jsonLd = JSON.stringify({ '@type': 'Organization', name: 'Example Corp', url: 'https://example.com' });
    const html = `<html><head><script type="application/ld+json">${jsonLd}</script></head><body><h1>Welcome</h1><p>We provide enterprise compliance scanning software for European markets. Our platform covers accessibility, privacy, and security in one scan.</p></body></html>`;

    const snap: PropertySnapshot = {
      scanId: 'fixture-clean-guard',
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
      originArtifacts: { robotsTxt, llmsTxt },
    };

    const byRule = runFixture(snap);
    expect([...byRule.keys()]).toHaveLength(0);
  });
});
