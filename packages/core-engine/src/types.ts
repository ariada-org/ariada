// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import type { ScanEvent, ScanEventEmitter } from './events.js';
import type { Logger } from './logger.js';

/**
 *
 */
export type Domain = 'a11y' | 'wsg' | 'cwv' | 'gdpr' | 'seo' | 'security' | 'cross' | (string & {});
/**
 *
 */
export type Severity = 'critical' | 'serious' | 'moderate' | 'minor';

/**
 *
 */
export type BackendNodeId = number;

/**
 *
 */
export interface AXNode {
  nodeId: string;
  backendDOMNodeId?: BackendNodeId;
  role?: { type: string; value: unknown };
  name?: { type: string; value: unknown };
  properties?: Array<{ name: string; value: { type: string; value: unknown } }>;
  childIds?: string[];
  ignored?: boolean;
  ignoredReasons?: unknown[];
  frameId?: string;
}

/**
 *
 */
export interface AXNodeRef {
  backendNodeId?: BackendNodeId;
  selector: string;
  role?: string;
  name?: string;
}

/**
 *
 */
export interface BoundingBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 *
 */
export interface UnifiedSnapshot {
  scanId: string;
  url: string;
  timestamp: number;
  axTree: AXNode[];
  domOutline: Array<{
    backendNodeId: BackendNodeId;
    nodeName: string;
    selector: string;
    frameId?: string;
    attributes?: Record<string, string>;
  }>;
  perfMetrics: Record<string, number>;
  networkResources: Array<{
    url: string;
    status?: number;
    mimeType?: string;
    size?: number;
  }>;
  screenshot?: Uint8Array;
  timings: {
    navigationMs: number;
    axTreeMs: number;
    domMs: number;
    totalMs: number;
  };
  /** Raw HTML of the captured document, when the surface records it. */
  html?: string;
  /** The body as it arrived, before any script ran.
   *
   *  Kept beside the rendered document rather than instead of it: whether a
   *  page assembles itself in the browser is a comparison between the two, and
   *  neither one alone can answer it. */
  initialHtml?: string;
  /** Response headers as captured, lower-cased keys, when available. */
  headers?: Record<string, string>;
  /** Cookies observed during capture, when available. */
  cookies?: Array<{
    name: string;
    value: string;
    domain?: string;
    path?: string;
    expires?: number;
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: 'Strict' | 'Lax' | 'None';
  }>;
  /**
   * Findings from the full rule library run against the live page at capture
   * time, when the surface ran it. Carried so domains whose extractors cannot
   * touch the live page still benefit from the broad rule surface.
   */
  axeFindings?: Finding[];
}

/**
 * What a finding is required by, and under which reference.
 *
 * The list used to hold only binding law and the standards it cites, which
 * left nowhere to put a recommendation — and the sustainability rules were
 * consequently filed under the European Accessibility Act, citing clauses of
 * the Web Sustainability Guidelines. Those are a draft of a W3C community
 * group; the Act says nothing about page weight or image formats. A report
 * built from that placed advisory items under a heading of European law,
 * which is the kind of error that invalidates the whole document rather than
 * one line of it.
 *
 * `WSG` is therefore listed in its own right, and its standing is stated:
 *
 * | Reference | What it is |
 * |---|---|
 * | `EAA` | Directive (EU) 2019/882 — binding law |
 * | `EN 301 549` | the European standard the Act cites |
 * | `WCAG` | W3C Recommendation, cited by the standard |
 * | `ADA`, `Section 508` | United States law |
 * | `GDPR` | Regulation (EU) 2016/679 — binding law |
 * | `WSG` | W3C community-group draft — **advisory, not required by anyone** |
 *
 * Anything reported under `WSG` must be presented as a recommendation. It does
 * not belong in a conformance claim.
 */
export interface RegulatoryRef {
  framework: 'WCAG' | 'EN 301 549' | 'ADA' | 'EAA' | 'GDPR' | 'Section 508' | 'WSG';
  code: string;
}

/**
 *
 */
export interface Finding {
  id: string;
  scanId: string;
  domain: Domain;
  ruleId: string;
  severity: Severity;
  element: AXNodeRef;
  message: string;
  criterion?: string;
  wcagMapping?: string[];
  regulatoryMapping?: RegulatoryRef[];
  fingerprint?: string;
  confidence?: number;
  /**
   * True when the rule library reported this as a needs-manual-review candidate
   * (e.g. axe-core's `incomplete` bucket) rather than a definite violation. The
   * gate profile decides whether needs-review findings warn or fail; they are
   * always surfaced so they are never silently dropped.
   */
  needsReview?: boolean;
}

/**
 * @deprecated Superseded by the cross-domain interaction detector's declarative
 * `InteractionFeatureSpec` (see `DomainModule.interactionFeatures` in
 * `./domain-contract.js`). Retained for the legacy single-domain analyzer path.
 */
export interface ConflictSignature {
  id: string;
  domains: [Domain, Domain];
  describe: string;
  match: (findingsByDomain: ReadonlyMap<Domain, readonly Finding[]>) => Finding[] | undefined;
}

/**
 *
 */
export interface ConflictFinding extends Finding {
  domain: 'cross';
  conflictingDomains: Domain[];
  participants: AXNodeRef[];
  remediation?: string;
}

/**
 * Optional regulatory + presentation metadata an analyzer declares. v0.1 keeps
 * this field optional on `DomainAnalyzer`; v0.2 will require it.
 */
export interface AnalyzerMetadata {
  readonly displayName: string;
  readonly description: string;
  readonly helpUrl?: string;
  readonly defaultSeverity: Severity;
  readonly regulatoryMappings: readonly RegulatoryRef[];
  readonly wcagSuccessCriteria?: readonly string[];
  readonly en301549Clauses?: readonly string[];
  readonly eaaAnnexI?: readonly string[];
  readonly bfsgArt?: readonly string[];
  readonly rgaaCriteres?: readonly string[];
  readonly tags?: readonly string[];
}

/**
 * @deprecated Superseded by `DomainModule` (see `./domain-contract.js`), which registers
 * feature extractors into one shared pass instead of running its own analysis.
 * Use `analyzerToDomainModule` (see `./analyzer-bridge.js`) to adapt an existing
 * analyzer to the new contract.
 */
export interface DomainAnalyzer {
  readonly domain: Domain;
  readonly version: string;
  readonly ruleIds: readonly string[];
  /**
   * Optional regulatory/presentation metadata. Recommended in v0.1; will
   * become required in a future version.
   */
  // TODO(future): make `metadata` required — flip `metadata?:` to `metadata:`.
  readonly metadata?: AnalyzerMetadata;
  readonly conflictSignatures?: readonly ConflictSignature[];
  /**
   * Pure async function from `AnalyzerContext` → `Finding[]`. Returns the
   * full batch — streaming via `AsyncIterable<Finding>` is reserved for a
   * future version.
   */
  analyze(ctx: AnalyzerContext): Promise<Finding[]>;
  analyzeElement?(ctx: AnalyzerContext, target: ElementTarget): Promise<Finding[]>;
  /**
   * Optional cleanup hook. Called by the orchestrator exactly once at end of
   * scan (in a `finally` block, even when the scan throws). Sync or async.
   * Must be idempotent.
   */
  dispose?(): void | Promise<void>;
}

// TODO(future): per-analyzer `timeoutMs` enforcement via Promise.race.

/**
 * Handed to every analyzer. The snapshot is read-only; the `page` handle is
 * provided for analyzers that need to run page-context eval (e.g., axe-core
 * injection via `@axe-core/playwright`). Most analyzers will only read snapshot.
 */
export interface AnalyzerContext {
  readonly snapshot: UnifiedSnapshot;
  readonly page: unknown;
  readonly logger: Logger;
}

/**
 *
 */
export interface ElementTarget {
  backendNodeId?: BackendNodeId;
  selector: string;
}

/**
 *
 */
export interface ScanStats {
  totalViolations: number;
  durationMs: number;
  analyzersRun: string[];
  elementsScanned: number;
}

/**
 *
 */
export interface UnifiedReport {
  scanId: string;
  url: string;
  timestamp: number;
  snapshot: UnifiedSnapshot;
  findings: Record<string, Finding[]>;
  conflicts: ConflictFinding[];
  stats: ScanStats;
}

/**
 *
 */
export interface ScanOptions {
  domains?: Domain[];
  ai?: 'off' | 'opt-in' | 'full';
  elementIter?: boolean;
  emitter?: ScanEventEmitter;
  timeoutMs?: number;
  playwright?: {
    browser?: 'chromium' | 'firefox' | 'webkit';
    headless?: boolean;
  };
  analyzers?: DomainAnalyzer[];
  logger?: Logger;
  screenshot?: boolean;
  /**
   * Allow the scanner to reach loopback/private/link-local destinations.
   * Off by default so a user-supplied URL cannot make the worker fetch cloud
   * metadata or internal services (SSRF). Intended only for local development.
   */
  allowPrivate?: boolean;
}

/**
 *
 */
export interface Scanner {
  scan(url: string, opts?: ScanOptions): Promise<ScanResult>;
}

/**
 *
 */
export interface ScanResult {
  report: UnifiedReport;
  events?: ScanEvent[];
}
