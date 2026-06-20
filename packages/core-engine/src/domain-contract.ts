// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import type { AXNode, BackendNodeId, Finding, RegulatoryRef } from './types.js';

/**
 * One cookie observed during capture.
 */
export interface SnapshotCookie {
  name: string;
  value: string;
  domain?: string;
  path?: string;
  expires?: number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'Strict' | 'Lax' | 'None';
}

/**
 * Transport-security metadata for the captured origin.
 */
export interface TlsMeta {
  protocol?: string;
  cipher?: string;
  validFrom?: number;
  validTo?: number;
  issuer?: string;
}

/**
 * Origin-level artefacts captured alongside the page, used by domains that read
 * the origin rather than the document (e.g. crawler and green-hosting checks).
 */
export interface OriginArtifacts {
  robotsTxt?: string;
  llmsTxt?: string;
  greenHosting?: boolean;
}

/**
 * A captured site: the raw HTML, response headers, cookies, accessibility tree,
 * element outline, performance metrics and network log recorded once per scanned
 * page. The one shared walker runs over this snapshot exactly once, regardless of
 * how many domains are registered.
 *
 * This is a superset of the legacy `UnifiedSnapshot` (it adds `html`, `headers`
 * and `cookies`) and is defined standalone so the multi-domain contract is not
 * coupled to the single-domain snapshot shape. The optional `responseHeaders`,
 * `tlsMeta` and `originArtifacts` fields are reserved for the security, privacy
 * and origin-reading domains; a capturing surface populates them when available.
 */
export interface PropertySnapshot {
  scanId: string;
  url: string;
  timestamp: number;
  /** Raw HTML of the captured document. */
  html: string;
  /** Request/response headers as captured, lower-cased keys. */
  headers: Record<string, string>;
  /** Cookies observed during capture. */
  cookies: readonly SnapshotCookie[];
  networkResources: ReadonlyArray<{
    url: string;
    status?: number;
    mimeType?: string;
    size?: number;
  }>;
  axTree: readonly AXNode[];
  /** The element outline the shared walker traverses exactly once. */
  domOutline: ReadonlyArray<{
    backendNodeId: BackendNodeId;
    nodeName: string;
    selector: string;
    frameId?: string;
    /** Element attributes, captured during the same DOM walk that built the outline. */
    attributes?: Record<string, string>;
  }>;
  perfMetrics: Record<string, number>;
  timings: {
    navigationMs: number;
    axTreeMs: number;
    domMs: number;
    totalMs: number;
  };
  /** Response headers keyed by resource url, when the surface records them. */
  responseHeaders?: Record<string, Record<string, string>>;
  /** Transport-security metadata for the captured origin, when available. */
  tlsMeta?: TlsMeta;
  /** Origin-level artefacts (robots.txt, llms.txt, green-hosting), when fetched. */
  originArtifacts?: OriginArtifacts;
  /**
   * Findings produced by running the full rule library (axe-core) against the
   * live page at capture time. Because that rule library needs the live page —
   * which an extractor never has — these are computed once during capture and
   * carried on the snapshot, then surfaced (deduplicated against the snapshot
   * rules) by the accessibility domain's deterministic `evaluate`. Absent when
   * the capturing surface did not run the rule library.
   */
  axeFindings?: readonly Finding[];
}

/**
 * A view of one element handed to a domain's `perElement` extractor by the shared
 * walker. The walker owns traversal; a module never traverses on its own.
 */
export interface ElementHandle {
  readonly backendNodeId?: BackendNodeId;
  /** Upper-cased node name as captured (e.g. `IMG`, `SCRIPT`, `P`). */
  readonly nodeName: string;
  readonly selector: string;
  readonly frameId?: string;
  /**
   * Element attributes when the capturing surface records them. The base
   * snapshot's element outline carries identity (selector, node name) but not
   * attribute maps, so this is absent unless a richer surface provides it.
   */
  readonly attributes?: Readonly<Record<string, string>>;
}

/**
 * Write surface a domain's extractors use to record features during the single
 * shared pass. `set` attributes a feature to an element key (the element's
 * selector); the cross-domain detector correlates features that share a join
 * scope and value. `setScoped` records a feature on a non-element join scope
 * (cookie, request, origin, page or document) so features that meet off the DOM
 * — a privacy cookie feature and a security cookie feature on the same cookie —
 * can still be correlated.
 */
export interface FeatureSink {
  /** Record an element-scoped feature; the element selector is the join value. */
  set(elementKey: string, featureKey: string, value: unknown): void;
  /** Record a feature on an explicit join scope and value. */
  setScoped(scope: JoinScope, joinValue: string, featureKey: string, value: unknown): void;
}

/**
 * One feature instance recorded under a join scope and value, as the detector
 * sees it. The `domainId` and `featureKey` identify the feature; `joinValue` is
 * the shared value two domains must match on within `scope` to interact.
 */
export interface CorrelatedFeature {
  readonly domainId: string;
  readonly featureKey: string;
  readonly value: unknown;
  readonly scope: JoinScope;
  readonly joinValue: string;
}

/**
 * The features recorded during the shared pass.
 *
 * - `byElement` maps an element key to the features each domain set on it; used
 *   by domains' `evaluate`.
 * - `byDocument` holds document-level features keyed by feature key.
 * - `byScope` is the generic correlation index the cross-domain detector reads:
 *   a join scope maps a join value to every feature recorded under it, across
 *   all domains. Element features also appear here under the `element` scope.
 *   The shared walker always populates it; it is optional only so a feature set
 *   hand-built from element features alone is still valid (the detector then
 *   reconstructs the element-scope groups from `byElement`).
 */
export interface ExtractedFeatures {
  byElement: Map<string, { domainFeatures: Record<string, Map<string, unknown>> }>;
  byDocument: Map<string, unknown>;
  byScope?: Map<JoinScope, Map<string, CorrelatedFeature[]>>;
}

/**
 * Context passed to {@link DomainModule.applicability} so a domain can opt out of
 * a given site before any of its extractors run.
 */
export interface SiteContext {
  readonly url: string;
  readonly origin: string;
  readonly snapshot: PropertySnapshot;
}

/**
 * The shared dimension on which two domains' features are joined to test for an
 * interaction. Two features interact only when they share the same join value
 * within the same scope — e.g. the same element, the same cookie, or the same
 * network request.
 */
export type JoinScope = 'element' | 'document' | 'cookie' | 'request' | 'origin' | 'page';

/**
 * One cross-domain interaction a domain declares it can take part in. Declarative:
 * the module names a feature key the detector reads and the scope on which it is
 * joined to another domain's feature; the detector — not the module — decides
 * whether an interaction fired.
 */
export interface InteractionFeatureSpec {
  readonly key: string;
  readonly description: string;
  /** The dimension this feature is joined on against another domain's feature. */
  readonly joinScope: JoinScope;
}

/**
 * The domain-module contract. A domain registers feature extractors into the one
 * shared walker, a deterministic rule engine over those features, and the
 * cross-domain interactions it participates in. It does not run its own scan and
 * it does not traverse the DOM — adding a domain adds zero extra DOM passes.
 */
export interface DomainModule {
  /** Stable identifier, e.g. `accessibility`, `sustainability`. Never a website. */
  readonly id: string;
  readonly title: string;
  readonly version: string;
  /** Optional gate: return false to skip this domain for a given site. */
  applicability?(ctx: SiteContext): boolean | Promise<boolean>;

  /**
   * Hooks the shared walker invokes per element and once per document. Extractors
   * MUST be pure and synchronous over the snapshot they are given: no network, no
   * filesystem, no additional fetching, no DOM mutation. All I/O happens during
   * capture, before the shared pass; an extractor that needs more data is asking
   * for a richer snapshot, not for permission to fetch.
   */
  readonly extractors: {
    /** Runs during the shared traversal for each element. No own traversal, no I/O. */
    perElement?(el: ElementHandle, acc: FeatureSink): void;
    /** Runs once per document with the whole snapshot. No I/O. */
    perDocument?(snap: PropertySnapshot, acc: FeatureSink): void;
  };

  /** Deterministic: features → findings against this domain's standard. */
  evaluate(features: ExtractedFeatures): Finding[];

  /**
   * Optional cross-site aggregation, invoked once at report assembly with every
   * site's per-domain result. Use it for findings that only exist in aggregate
   * (e.g. a brand-wide inconsistency); per-site findings come from `evaluate`.
   */
  aggregate?(sites: readonly PerSiteResult[]): Finding[];

  readonly regulatory?: readonly RegulatoryRef[];

  /** Declares which cross-domain interactions this domain can take part in. */
  readonly interactionFeatures?: readonly InteractionFeatureSpec[];
}

/**
 * One site's evaluated result for a single domain, handed to {@link
 * DomainModule.aggregate} so a domain can reason across all scanned sites at
 * report-assembly time.
 */
export interface PerSiteResult {
  readonly site: string;
  readonly features: ExtractedFeatures;
  readonly findings: readonly Finding[];
}

/**
 * One predicted interaction between two domains on a shared element key.
 * `predictedEffect` describes what remediating one side does to the other;
 * `type` says whether the relationship is a conflict or a synergy.
 */
export interface InteractionRecord {
  readonly id: string;
  readonly type: 'conflict' | 'synergy';
  readonly domains: readonly string[];
  readonly elementKey: string;
  readonly predictedEffect: string;
  readonly confidence: number;
}

/**
 * One rule that fails on at least K sites — a problem that is systemic across the
 * brand rather than isolated to one property.
 */
export interface SystemicIssue {
  readonly domain: string;
  readonly ruleId: string;
  readonly affectedSites: readonly string[];
}

/**
 * One rule that fails on some sites but passes on others (e.g. `.de` fails where
 * `.com` passes) — a divergence worth surfacing.
 */
export interface Divergence {
  readonly domain: string;
  readonly ruleId: string;
  readonly failingSites: readonly string[];
  readonly passingSites: readonly string[];
}

/**
 * The cross-site axis: the same domain compared across sites.
 */
export interface CrossSiteAxis {
  readonly systemic: readonly SystemicIssue[];
  readonly divergence: readonly Divergence[];
}

/**
 * The unified output every renderer and platform plugin consumes. `grid` is keyed
 * `grid[siteUrl][domainId]` → the findings for that site-and-domain pair.
 */
export interface MultiDomainReport {
  readonly sites: readonly string[];
  readonly domains: readonly string[];
  readonly grid: Record<string, Record<string, Finding[]>>;
  readonly interactions: readonly InteractionRecord[];
  readonly crossSite: CrossSiteAxis;
  /** Cross-site findings produced by domains' aggregate hooks, when any fired. */
  readonly aggregateFindings?: readonly Finding[];
}
