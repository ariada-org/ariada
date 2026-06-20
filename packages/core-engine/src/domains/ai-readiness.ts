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
// Domain identifier constant (prevents the duplicate-string sonarjs warning)
// ---------------------------------------------------------------------------

const DOMAIN_ID = 'ai-readiness';

// ---------------------------------------------------------------------------
// Feature keys
// ---------------------------------------------------------------------------

/** robots.txt was fetched and is non-empty. */
export const AI_ROBOTS_PRESENT = 'ai:robots.present';
/** robots.txt explicitly disallows at least one known AI crawler. */
export const AI_ROBOTS_CRAWLER_BLOCKED = 'ai:robots.crawler-blocked';
/** Which AI crawler user-agents are blocked (comma-separated names). */
export const AI_ROBOTS_BLOCKED_AGENTS = 'ai:robots.blocked-agents';
/** robots.txt has a Crawl-delay > 60 for at least one AI crawler. */
export const AI_ROBOTS_DELAY_EXCESSIVE = 'ai:robots.crawl-delay-excessive';

/** /llms.txt was fetched and is non-empty. */
export const AI_LLMSTXT_PRESENT = 'ai:llmstxt.present';
/** llms.txt starts with an H1 and contains at least one URL. */
export const AI_LLMSTXT_VALID_STRUCTURE = 'ai:llmstxt.valid-structure';
/** noai X-Robots-Tag header contradicts llms.txt presence. */
export const AI_LLMSTXT_NOAI_CONTRADICTION = 'ai:llmstxt.noai-contradiction';

/** Page has at least one application/ld+json script block. */
export const AI_SD_JSON_LD_PRESENT = 'ai:sd.json-ld-present';
/** Missing required Schema.org property — value is the type:prop description. */
export const AI_SD_MISSING_REQUIRED_PROP = 'ai:sd.missing-required-prop';
/** Page body is absent from initial HTML (JS-only rendering). */
export const AI_RENDERING_JS_ONLY = 'ai:rendering.js-only';

// ---------------------------------------------------------------------------
// Rule IDs
// ---------------------------------------------------------------------------

const RULE_ROBOTS_MISSING = 'ai-readiness/robots-missing';
const RULE_CRAWLER_BLOCKED = 'ai-readiness/crawler-blocked';
const RULE_CRAWL_DELAY_EXCESSIVE = 'ai-readiness/crawl-delay-excessive';
const RULE_LLMSTXT_MISSING = 'ai-readiness/llmstxt-missing';
const RULE_LLMSTXT_INVALID_STRUCTURE = 'ai-readiness/llmstxt-invalid-structure';
const RULE_LLMSTXT_NOAI_CONTRADICTION = 'ai-readiness/llmstxt-noai-contradiction';
const RULE_NO_JSON_LD = 'ai-readiness/no-json-ld';
const RULE_JSON_LD_MISSING_REQUIRED_PROP = 'ai-readiness/json-ld-missing-required-prop';
const RULE_JS_ONLY_RENDER = 'ai-readiness/js-only-render';

// ---------------------------------------------------------------------------
// Tracked AI crawler user-agents
// ---------------------------------------------------------------------------

const AI_CRAWLERS: readonly string[] = [
  'gptbot',
  'claudebot',
  'anthropic-ai',
  'perplexitybot',
  'google-extended',
  'ccbot',
  'bytespider',
];

// ---------------------------------------------------------------------------
// Required Schema.org properties per type
// ---------------------------------------------------------------------------

const REQUIRED_PROPS: Record<string, readonly string[]> = {
  Organization: ['name', 'url'],
  Product: ['name'],
  Article: ['headline', 'author', 'datePublished'],
  FAQPage: ['mainEntity'],
  BreadcrumbList: ['itemListElement'],
};

// ---------------------------------------------------------------------------
// robots.txt parser — split into small helpers to stay within cognitive limits
// ---------------------------------------------------------------------------

interface RobotsParseResult {
  blockedAgents: string[];
  delayExcessive: boolean;
}

function extractOrigin(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return url;
  }
}

/** Add each AI crawler to the blocked list when a catch-all wildcard fires. */
function blockAllCrawlers(result: RobotsParseResult): void {
  for (const crawler of AI_CRAWLERS) {
    if (!result.blockedAgents.includes(crawler)) {
      result.blockedAgents.push(crawler);
    }
  }
}

/** Add a single named crawler to the blocked list if not already present. */
function blockNamedCrawler(result: RobotsParseResult, agent: string): void {
  if (!result.blockedAgents.includes(agent)) {
    result.blockedAgents.push(agent);
  }
}

/** Handle a Disallow: / line for the agents in the current stanza. */
function applyDisallowAll(result: RobotsParseResult, agents: readonly string[]): void {
  for (const agent of agents) {
    if (agent === '*') {
      blockAllCrawlers(result);
    } else if (AI_CRAWLERS.includes(agent)) {
      blockNamedCrawler(result, agent);
    }
  }
}

/** Handle a Crawl-delay line; set flag when value exceeds 60 seconds. */
function applyCrawlDelay(result: RobotsParseResult, agents: readonly string[], raw: string): void {
  const delay = Number(raw);
  if (Number.isNaN(delay) || delay <= 60) return;

  for (const agent of agents) {
    if (agent === '*' || AI_CRAWLERS.includes(agent)) {
      result.delayExcessive = true;
      return;
    }
  }
}

/** Parse one non-comment, non-blank directive line. */
function applyDirective(
  result: RobotsParseResult,
  agents: readonly string[],
  field: string,
  value: string,
): void {
  if (field === 'disallow' && value === '/') {
    applyDisallowAll(result, agents);
  } else if (field === 'crawl-delay') {
    applyCrawlDelay(result, agents, value);
  }
}

function parseRobotsTxt(raw: string): RobotsParseResult {
  const result: RobotsParseResult = { blockedAgents: [], delayExcessive: false };
  let currentAgents: string[] = [];

  for (const rawLine of raw.split('\n')) {
    const line = rawLine.trim();

    if (line === '' || line.startsWith('#')) {
      currentAgents = [];
      continue;
    }

    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;

    const field = line.slice(0, colonIdx).trim().toLowerCase();
    const value = line.slice(colonIdx + 1).trim();

    if (field === 'user-agent') {
      currentAgents.push(value.toLowerCase());
      continue;
    }

    applyDirective(result, currentAgents, field, value);
  }

  return result;
}

// ---------------------------------------------------------------------------
// llms.txt structural validator
// ---------------------------------------------------------------------------

interface LlmsTxtParseResult {
  hasH1: boolean;
  hasUrl: boolean;
  noaiContradiction: boolean;
}

function parseLlmsTxt(raw: string, responseHeaders: Record<string, string>): LlmsTxtParseResult {
  const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean);
  const hasH1 = lines.some((l) => l.startsWith('# '));
  const urlPattern = /https?:\/\/\S+/;
  const hasUrl = lines.some((l) => urlPattern.test(l));
  const xRobotsTag = responseHeaders['x-robots-tag'] ?? '';
  const noaiContradiction = /\bnoai\b|\bnoindex\b/i.test(xRobotsTag);
  return { hasH1, hasUrl, noaiContradiction };
}

// ---------------------------------------------------------------------------
// JSON-LD structured data extractor
// ---------------------------------------------------------------------------

interface JsonLdParseResult {
  present: boolean;
  missingProps: Array<{ type: string; prop: string }>;
}

function checkSchemaProps(
  obj: Record<string, unknown>,
  result: JsonLdParseResult,
): void {
  const schemaType = (obj['@type'] as string | undefined) ?? '';
  const required = REQUIRED_PROPS[schemaType];
  if (!required) return;

  for (const prop of required) {
    if (!(prop in obj) || obj[prop] == null || obj[prop] === '') {
      result.missingProps.push({ type: schemaType, prop });
    }
  }
}

function parseJsonLdBlock(content: string, result: JsonLdParseResult): void {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return;
  }

  result.present = true;
  const entries: unknown[] = Array.isArray(parsed) ? parsed : [parsed];
  for (const entry of entries) {
    if (typeof entry !== 'object' || entry === null) continue;
    checkSchemaProps(entry as Record<string, unknown>, result);
  }
}

function parseJsonLd(html: string): JsonLdParseResult {
  const result: JsonLdParseResult = { present: false, missingProps: [] };
  // Extract <script type="application/ld+json"> blocks.
  // No DOM parser — core-engine is Node-free by invariant; regex over captured HTML is correct here.
  const scriptPattern = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;

  while ((match = scriptPattern.exec(html)) !== null) {
    const content = match[1]?.trim() ?? '';
    if (content) parseJsonLdBlock(content, result);
  }

  return result;
}

// ---------------------------------------------------------------------------
// JS-only rendering detection
// ---------------------------------------------------------------------------

/**
 * Returns true when the body carries fewer than 50 characters of non-tag text
 * — a reliable signal that the page relies on client-side JavaScript to inject
 * its content. AI crawlers that do not execute JavaScript will index an empty
 * shell. The threshold is deliberately conservative: even minimalist landing
 * pages carry navigation labels and a heading that together exceed 50 chars.
 */
function detectJsOnlyRendering(html: string): boolean {
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const bodyHtml = bodyMatch?.[1] ?? html;
  const text = bodyHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return text.length < 50;
}

// ---------------------------------------------------------------------------
// perDocument extractor
// ---------------------------------------------------------------------------

function emitRobotFeatures(
  acc: FeatureSink,
  origin: string,
  robotsTxt: string,
): void {
  if (!robotsTxt.trim()) {
    acc.setScoped('origin', origin, AI_ROBOTS_PRESENT, false);
    return;
  }

  const robots = parseRobotsTxt(robotsTxt);
  acc.setScoped('origin', origin, AI_ROBOTS_PRESENT, true);

  if (robots.blockedAgents.length > 0) {
    acc.setScoped('origin', origin, AI_ROBOTS_CRAWLER_BLOCKED, true);
    acc.setScoped('origin', origin, AI_ROBOTS_BLOCKED_AGENTS, robots.blockedAgents.join(','));
  }
  if (robots.delayExcessive) {
    acc.setScoped('origin', origin, AI_ROBOTS_DELAY_EXCESSIVE, true);
  }
}

function emitLlmsTxtFeatures(
  acc: FeatureSink,
  origin: string,
  llmsTxt: string,
  headers: Record<string, string>,
): void {
  if (!llmsTxt.trim()) {
    acc.setScoped('origin', origin, AI_LLMSTXT_PRESENT, false);
    return;
  }

  acc.setScoped('origin', origin, AI_LLMSTXT_PRESENT, true);
  const llms = parseLlmsTxt(llmsTxt, headers);
  acc.setScoped('origin', origin, AI_LLMSTXT_VALID_STRUCTURE, llms.hasH1 && llms.hasUrl);
  if (llms.noaiContradiction) {
    acc.setScoped('origin', origin, AI_LLMSTXT_NOAI_CONTRADICTION, true);
  }
}

function runPerDocument(snap: PropertySnapshot, acc: FeatureSink): void {
  const origin = extractOrigin(snap.url);
  const artifacts = snap.originArtifacts;

  // robots.txt — from optional originArtifacts; absent = treat as missing
  emitRobotFeatures(acc, origin, artifacts?.robotsTxt ?? '');

  // llms.txt — from optional originArtifacts; absent = treat as missing
  emitLlmsTxtFeatures(acc, origin, artifacts?.llmsTxt ?? '', snap.headers);

  // JSON-LD structured data
  const jsonLd = parseJsonLd(snap.html);
  acc.setScoped('document', snap.url, AI_SD_JSON_LD_PRESENT, jsonLd.present);
  for (const { type, prop } of jsonLd.missingProps) {
    acc.setScoped('document', snap.url, `${AI_SD_MISSING_REQUIRED_PROP}:${type}.${prop}`, true);
  }

  // JS-only rendering detection
  acc.setScoped('page', snap.url, AI_RENDERING_JS_ONLY, detectJsOnlyRendering(snap.html));
}

// ---------------------------------------------------------------------------
// evaluate helpers — one function per rule family to keep CC low
// ---------------------------------------------------------------------------

function makeFinding(
  id: string,
  ruleId: string,
  severity: Finding['severity'],
  message: string,
): Finding {
  return {
    id,
    scanId: '',
    domain: DOMAIN_ID,
    ruleId,
    severity,
    element: { selector: ':root' },
    message,
    regulatoryMapping: [],
  };
}

type ByKey = Map<string, unknown>;

function originFindings(originKey: string, byKey: ByKey): Finding[] {
  const out: Finding[] = [];

  if (byKey.get(AI_ROBOTS_PRESENT) === false) {
    out.push(makeFinding(
      `${RULE_ROBOTS_MISSING}-${originKey}`,
      RULE_ROBOTS_MISSING,
      'serious',
      'No robots.txt found at the site root — AI crawlers apply fallback defaults and may over-index or under-index this site.',
    ));
  }

  if (byKey.get(AI_ROBOTS_CRAWLER_BLOCKED) === true) {
    const blockedAgents = (byKey.get(AI_ROBOTS_BLOCKED_AGENTS) as string | undefined) ?? '';
    out.push(makeFinding(
      `${RULE_CRAWLER_BLOCKED}-${originKey}`,
      RULE_CRAWLER_BLOCKED,
      'serious',
      `The following AI crawlers are disallowed in robots.txt: ${blockedAgents}. These agents will not index this site's content.`,
    ));
  }

  if (byKey.get(AI_ROBOTS_DELAY_EXCESSIVE) === true) {
    out.push(makeFinding(
      `${RULE_CRAWL_DELAY_EXCESSIVE}-${originKey}`,
      RULE_CRAWL_DELAY_EXCESSIVE,
      'moderate',
      'A Crawl-delay directive greater than 60 seconds is set for an AI crawler in robots.txt — this acts as a practical block for most AI indexing crawlers.',
    ));
  }

  if (byKey.get(AI_LLMSTXT_PRESENT) === false) {
    out.push(makeFinding(
      `${RULE_LLMSTXT_MISSING}-${originKey}`,
      RULE_LLMSTXT_MISSING,
      'moderate',
      'No llms.txt file found at the site root. This file helps LLM agents discover what content on this site they may read and cite.',
    ));
  }

  if (byKey.get(AI_LLMSTXT_PRESENT) === true && byKey.get(AI_LLMSTXT_VALID_STRUCTURE) === false) {
    out.push(makeFinding(
      `${RULE_LLMSTXT_INVALID_STRUCTURE}-${originKey}`,
      RULE_LLMSTXT_INVALID_STRUCTURE,
      'moderate',
      'The llms.txt file is present but does not start with a Markdown H1 heading or contains no URLs — LLM agents may not be able to parse it.',
    ));
  }

  if (byKey.get(AI_LLMSTXT_NOAI_CONTRADICTION) === true) {
    out.push(makeFinding(
      `${RULE_LLMSTXT_NOAI_CONTRADICTION}-${originKey}`,
      RULE_LLMSTXT_NOAI_CONTRADICTION,
      'moderate',
      'The response headers include X-Robots-Tag: noai or noindex while an llms.txt file exists — these signals contradict each other and will confuse AI crawlers.',
    ));
  }

  return out;
}

const MISSING_PROP_PREFIX = `${AI_SD_MISSING_REQUIRED_PROP}:`;

function documentFindings(docUrl: string, byKey: ByKey): Finding[] {
  const out: Finding[] = [];

  if (byKey.get(AI_SD_JSON_LD_PRESENT) === false) {
    out.push(makeFinding(
      `${RULE_NO_JSON_LD}-${docUrl}`,
      RULE_NO_JSON_LD,
      'minor',
      'No JSON-LD structured data block found on this page. Structured data helps AI citation engines understand and attribute content from this page.',
    ));
  }

  for (const [featureKey, value] of byKey) {
    if (!featureKey.startsWith(MISSING_PROP_PREFIX) || value !== true) continue;
    const typeAndProp = featureKey.slice(MISSING_PROP_PREFIX.length);
    out.push(makeFinding(
      `${RULE_JSON_LD_MISSING_REQUIRED_PROP}-${typeAndProp}-${docUrl}`,
      RULE_JSON_LD_MISSING_REQUIRED_PROP,
      'serious',
      `JSON-LD block of type ${typeAndProp.replace('.', ' is missing required property ')} — AI citation engines may not be able to extract structured metadata from this page.`,
    ));
  }

  return out;
}

function pageFindings(pageUrl: string, byKey: ByKey): Finding[] {
  if (byKey.get(AI_RENDERING_JS_ONLY) !== true) return [];

  return [makeFinding(
    `${RULE_JS_ONLY_RENDER}-${pageUrl}`,
    RULE_JS_ONLY_RENDER,
    'serious',
    'Page body content is absent from the initial HTML and appears to be injected by client-side JavaScript. AI crawlers that do not execute JavaScript will index an empty page.',
  )];
}

function runEvaluate(features: ExtractedFeatures): Finding[] {
  const findings: Finding[] = [];
  const byScope = features.byScope;
  if (!byScope) return findings;

  const originScope = byScope.get('origin');
  if (originScope) {
    for (const [originKey, correlated] of originScope) {
      const byKey = new Map(correlated.map((f) => [f.featureKey, f.value]));
      findings.push(...originFindings(originKey, byKey));
    }
  }

  const documentScope = byScope.get('document');
  if (documentScope) {
    for (const [docUrl, correlated] of documentScope) {
      const byKey = new Map(correlated.map((f) => [f.featureKey, f.value]));
      findings.push(...documentFindings(docUrl, byKey));
    }
  }

  const pageScope = byScope.get('page');
  if (pageScope) {
    for (const [pageUrl, correlated] of pageScope) {
      const byKey = new Map(correlated.map((f) => [f.featureKey, f.value]));
      findings.push(...pageFindings(pageUrl, byKey));
    }
  }

  return findings;
}

// ---------------------------------------------------------------------------
// DomainModule export
// ---------------------------------------------------------------------------

/**
 * AI readiness domain. Detects whether a web property is correctly configured
 * to be crawled, cited, and understood by LLM agents and AI search engines.
 *
 * Checks (all pure and synchronous over the captured PropertySnapshot):
 *   - robots.txt presence and AI-crawler directives (from originArtifacts.robotsTxt)
 *   - llms.txt presence and structural validity (from originArtifacts.llmsTxt)
 *   - JSON-LD structured data presence and required-property completeness
 *   - JS-only rendering detection (content absent from initial HTML)
 *
 * All origin-artifact fields are optional; the extractors tolerate their
 * absence and emit absence-findings rather than throwing.
 */
export const aiReadinessDomain: DomainModule = {
  id: DOMAIN_ID,
  title: 'AI Readiness',
  version: '0.1.0',

  extractors: {
    perDocument(snap: PropertySnapshot, acc: FeatureSink): void {
      runPerDocument(snap, acc);
    },
  },

  evaluate(features: ExtractedFeatures): Finding[] {
    return runEvaluate(features);
  },

  regulatory: [],

  /**
   * Cross-domain interaction features this domain participates in.
   *
   * JS-only rendering is a page-scope feature joined on the page URL. The
   * accessibility domain's equivalent JS-rendering detection (when implemented)
   * will also emit a page-scope feature on the same URL, letting the
   * cross-domain detector fire a conflict record: remediating JS-only rendering
   * (adding server-side rendering) resolves both findings at once.
   *
   * No seed pair currently exists in cross-domain-weights.json for ai-readiness.
   * These declarations are ready for when the detector is trained on the pair.
   */
  interactionFeatures: [
    {
      key: AI_RENDERING_JS_ONLY,
      description:
        "JS-only rendering blocks AI crawlers that do not execute JavaScript. Paired with the accessibility domain's JS-rendering detection, remediating this with server-side rendering fixes both findings at once.",
      joinScope: 'page',
    },
    {
      key: AI_ROBOTS_CRAWLER_BLOCKED,
      description:
        'An AI crawler is explicitly disallowed in robots.txt. This origin-scoped feature can be correlated against a privacy or security domain feature on the same origin when both observe the same origin-level configuration.',
      joinScope: 'origin',
    },
    {
      key: AI_SD_JSON_LD_PRESENT,
      description:
        "Presence of JSON-LD structured data on a page. Paired with the structured-data domain's JSON-LD coverage feature on the same document URL, one JSON-LD block satisfies both AI citation and structured-data requirements.",
      joinScope: 'document',
    },
  ],
};
