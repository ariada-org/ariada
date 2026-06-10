// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import type { AXNode, BackendNodeId, Finding, RegulatoryRef } from './types.js';

/**
 * A captured site: the raw HTML, response headers, cookies, accessibility tree,
 * element outline, performance metrics and network log recorded once per scanned
 * page. The one shared walker runs over this snapshot exactly once, regardless of
 * how many domains are registered.
 *
 * This is a superset of the legacy `UnifiedSnapshot` (it adds `html`, `headers`
 * and `cookies`) and is defined standalone so the multi-domain contract is not
 * coupled to the single-domain snapshot shape.
 */
export interface PropertySnapshot {
  scanId: string;
  url: string;
  timestamp: number;
  /** Raw HTML of the captured document. */
  html: string;
  /** Response headers, lower-cased keys. */
  headers: Record<string, string>;
  /** Cookies observed during capture. */
  cookies: readonly unknown[];
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
  }>;
  perfMetrics: Record<string, number>;
  timings: {
    navigationMs: number;
    axTreeMs: number;
    domMs: number;
    totalMs: number;
  };
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
 * selector for `perElement`, a document key for `perDocument`) so features from
 * different domains on the same element can later be correlated.
 */
export interface FeatureSink {
  set(elementKey: string, featureKey: string, value: unknown): void;
}

/**
 * The features recorded during the shared pass. `byElement` maps an element key
 * to the features each domain set on it; `byDocument` holds document-level
 * features keyed by feature key.
 */
export interface ExtractedFeatures {
  /** elementKey → { domainFeatures: { [domainId]: Map<featureKey, value> } } */
  byElement: Map<string, { domainFeatures: Record<string, Map<string, unknown>> }>;
  /** featureKey → value, for document-level features. */
  byDocument: Map<string, unknown>;
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
 * One cross-domain interaction a domain declares it can take part in. Declarative:
 * the module names a feature key the detector reads; the detector — not the
 * module — decides whether an interaction fired.
 */
export interface InteractionFeatureSpec {
  readonly key: string;
  readonly description: string;
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

  /** Hooks the shared walker invokes per element and once per document. */
  readonly extractors: {
    /** Runs during the shared traversal for each element. No own traversal. */
    perElement?(el: ElementHandle, acc: FeatureSink): void;
    /** Runs once per document with the whole snapshot. */
    perDocument?(snap: PropertySnapshot, acc: FeatureSink): void;
  };

  /** Deterministic: features → findings against this domain's standard. */
  evaluate(features: ExtractedFeatures): Finding[];

  readonly regulatory?: readonly RegulatoryRef[];

  /** Declares which cross-domain interactions this domain can take part in. */
  readonly interactionFeatures?: readonly InteractionFeatureSpec[];
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
}
