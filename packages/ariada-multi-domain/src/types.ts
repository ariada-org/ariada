// SPDX-License-Identifier: EUPL-1.2
/**
 * Public type surface for `@ariada/multi-domain`.
 *
 * This package ships:
 *
 *   1. A canonical `ScanEvent` data contract — the upstream signal that
 *      downstream accessibility-compliance tooling consumes.
 *   2. A `JurisdictionPlugin` extension interface — community-authored
 *      rule packs implement this to register a new jurisdiction (for
 *      example Canada AODA, Japan JIS X 8341-3) against an instance of
 *      the reference orchestrator without modifying the package source.
 *   3. A single-jurisdiction reference orchestrator that ties the two
 *      together and produces a `ScanEvent` for one jurisdiction at a
 *      time.
 *
 * The reference orchestrator deliberately does NOT implement
 * cross-jurisdiction conflict resolution or any consensus / normalisation
 * heuristic across multiple jurisdictions in a single pass. Those
 * orchestration behaviours belong to a paid hosted service. Community
 * implementers MAY build their own multi-jurisdiction orchestrator on
 * top of the `JurisdictionPlugin` contract.
 *
 * Schema citations:
 *
 * @see https://www.w3.org/TR/WCAG22/ (WCAG 2.2)
 * @see https://www.etsi.org/deliver/etsi_en/301500_301599/301549/03.02.01_60/en_301549v030201p.pdf
 * @see https://eur-lex.europa.eu/eli/dir/2019/882/oj (Directive (EU) 2019/882 — European Accessibility Act)
 */

/**
 * ULID — sortable, monotonic 26-character identifier. Stringly typed at
 * this layer; downstream packages enforce the 26-character constraint.
 *
 * @see https://github.com/ulid/spec
 */
export type Ulid = string;

/** ISO-8601 timestamp string (e.g. "2026-05-20T10:15:00.000Z"). */
export type Iso8601 = string;

/** SHA-256 hex digest, 64 lowercase characters. */
export type Sha256Hex = string;

/** Conformance impact severity. Mirrors axe-core's impact taxonomy. */
export type Severity = 'minor' | 'moderate' | 'serious' | 'critical';

/**
 * Render viewport descriptor.
 *
 * A scan may capture more than one viewport, but a single
 * single-jurisdiction reference scan always captures at least one.
 */
export interface Viewport {
  /** Human label (e.g. "desktop", "mobile"). */
  label: string;
  /** Width in CSS pixels. */
  width: number;
  /** Height in CSS pixels. */
  height: number;
  /** Optional pixel density (1 for desktop, 2-3 for high-DPI mobile). */
  devicePixelRatio?: number;
}

/**
 * Authentication context passed by the caller. Held only in worker
 * memory; reference implementation never persists this value into a
 * `ScanEvent` record.
 */
export interface AuthContext {
  /** Optional bearer token. */
  bearer?: string;
  /** Optional cookie jar serialised as `name=value; name=value`. */
  cookieHeader?: string;
}

/** Screenshot capture policy. */
export type ScreenshotPolicy = 'anonymise' | 'none' | 'full';

/**
 * Evidence blob attached to a finding. The reference implementation
 * keeps this small — selector path, HTML snippet, optional screenshot
 * reference — so the schema is portable across storage backends.
 */
export interface EvidenceBlob {
  /** HTML snippet showing the offending element. */
  htmlSnippet: string;
  /** Stable CSS selector path. */
  selectorPath: string;
  /** Optional screenshot reference (URL, IPFS CID, S3 key). */
  screenshotRef?: string;
}

/**
 * A single accessibility finding. Each finding is tagged with one or
 * more jurisdiction codes; in the single-jurisdiction reference
 * orchestrator the tag list always contains exactly one entry, but the
 * data shape is forward-compatible with community-authored
 * multi-jurisdiction orchestrators that may emit findings tagged with
 * several jurisdiction codes simultaneously.
 */
export interface Finding {
  findingId: Ulid;
  ruleId: string;
  jurisdictionTags: string[];
  severity: Severity;
  /** Stable CSS selector. */
  selector: string;
  /** AX Tree node identifier, when available. */
  axTreeNodeId?: number;
  description: string;
  recommendation: string;
  evidence: EvidenceBlob;
  rationale: {
    primarySource: string;
    crossSource: string[];
  };
}

/** Jurisdiction subset record. */
export interface JurisdictionSubset {
  jurisdictionCode: string;
  jurisdictionLabel: string;
  governingRegulation: string;
  technicalStandard: string;
  /** `findingId` values that belong to this jurisdiction. */
  findings: Ulid[];
  /** Success-criterion pass rate, 0..1. */
  passRate: number;
  /** Count of success criteria deferred to manual human review. */
  pendingManualReview: number;
  evidence: {
    statementJurisdiction: string;
    vpatSection: string;
  };
}

/** Snapshot reference attached to a scan event. */
export interface SnapshotRef {
  domHash: Sha256Hex;
  axTreeHash: Sha256Hex;
  cssomHash: Sha256Hex;
  screenshotRefs: string[];
  viewports: Viewport[];
}

/**
 * Canonical scan event emitted by an orchestrator. Downstream
 * accessibility-compliance tooling consumes this record verbatim.
 *
 * The single-jurisdiction reference orchestrator populates
 * `perJurisdiction` with exactly one entry and leaves the `conflicts`
 * array empty (one jurisdiction cannot conflict with itself).
 *
 * Community-authored multi-jurisdiction orchestrators MAY populate
 * `perJurisdiction` with several entries and MAY surface
 * cross-jurisdiction divergences via the `conflicts` array. The shape
 * of the `conflicts` array is part of the published contract; the
 * heuristic that decides which findings are «in conflict» is not
 * supplied by this package.
 */
export interface ScanEvent {
  // Canonical identity.
  scanId: Ulid;
  scanTimestamp: Iso8601;
  scanDurationMs: number;
  scannerVersion: string;
  ruleEngineVersion: string;
  rulePackVersions: Record<string, string>;

  // Input echo.
  url: string;
  effectiveUrl: string;
  jurisdictionsRequested: string[];
  jurisdictionsDetected: string[];
  jurisdictionsEffective: string[];

  // Single snapshot reference.
  snapshot: SnapshotRef;

  // Findings.
  findings: Finding[];
  perJurisdiction: Record<string, JurisdictionSubset>;

  // Cross-jurisdiction divergence surface. Always `[]` in the
  // single-jurisdiction reference orchestrator.
  conflicts: CrossJurisdictionConflictDescriptor[];

  // Performance + observability.
  performance: {
    snapshotMs: number;
    analyzersMs: Record<string, number>;
    totalAnalyzersRun: number;
    parallelism: number;
  };
}

/**
 * Descriptor for a cross-jurisdiction divergence. The reference
 * orchestrator never populates this — it is part of the published
 * contract so community implementers can interoperate at the schema
 * level.
 *
 * The `resolution` field is purely descriptive; this package does NOT
 * supply a resolution policy. Community implementers choose their own.
 */
export interface CrossJurisdictionConflictDescriptor {
  conflictId: Ulid;
  ruleIds: string[];
  jurisdictions: string[];
  description: string;
  resolution: 'manual-review' | 'per-jurisdiction-separate';
}

/**
 * Input parameters accepted by the single-jurisdiction reference
 * orchestrator. The list deliberately mirrors the parameter table in
 * the engineering specification so plugin implementers can rely on a
 * single canonical shape.
 */
export interface ScanInput {
  /** Target URL to scan. Either `url` or `htmlSnapshot` is required. */
  url?: string;
  /** Pre-captured HTML / CSSOM / AX Tree blob. */
  htmlSnapshot?: string;
  /**
   * Optional list of jurisdiction codes. The reference orchestrator
   * accepts exactly one entry; supplying more than one is a usage
   * error and surfaces as a synchronous Error.
   */
  jurisdictions?: string[];
  wcagLevel?: 'A' | 'AA' | 'AAA';
  viewports?: Viewport[];
  userAgent?: string;
  auth?: AuthContext;
  screenshotPolicy?: ScreenshotPolicy;
}

/** Partial scan event passed to plugins during the analysis stage. */
export interface PartialScanContext {
  url: string;
  effectiveUrl: string;
  snapshot: SnapshotRef;
  /** Findings collected so far (read-only from a plugin's perspective). */
  findings: Finding[];
}
