// SPDX-License-Identifier: EUPL-1.2
/**
 * Public + internal types for `@ariada/anti-overlay`.
 *
 * Detection produces an OverlayReport describing zero or more detected
 * third-party accessibility-overlay vendors. Every report carries a
 * Citations block referencing the W3C-WAI Accessibility Overlay position
 * and the OverlayFactsheet community statement plus a verbatim
 * `NOT LEGAL ADVICE` disclaimer. The package is detection-only and does
 * not auto-fail, auto-disable, or recommend removal.
 */

/**
 * Confidence band assigned to a vendor hit per the rubric in
 * `confidence.ts`.
 */
export type Confidence = 'high' | 'medium' | 'low';

/**
 * Kind of pattern a signature looks for. The aggregator inspects the
 * mix of matched kinds to compute confidence.
 */
export type SignatureKind =
  | 'script-src'
  | 'dom-id'
  | 'class-prefix'
  | 'attribute'
  | 'iframe-src'
  | 'global-js';

/**
 * One signature within a vendor definition.
 */
export interface Signature {
  /** Kind of pattern. Drives confidence weighting. */
  readonly kind: SignatureKind;
  /** Linear-time pattern (regex, anchored / word-bounded). */
  readonly pattern: RegExp;
  /** Hint shown in the report locating where in the HTML the pattern lives. */
  readonly locationHint: string;
  /** Human-readable label rendered into `SignatureRef.value` on a hit. */
  readonly label: string;
}

/**
 * Per-vendor signature registry entry.
 */
export interface VendorSignature {
  /** Canonical vendor id (kebab-case). */
  readonly id: string;
  /** Display name for human-facing surfaces. */
  readonly displayName: string;
  /** ISO date the signature first entered the registry. */
  readonly firstSeen: string;
  /** ISO date of the last manual verification. */
  readonly lastVerified: string;
  /** Optional cap on confidence — used by the iframe-only variant. */
  readonly confidenceCap?: Confidence;
  /** All signatures the vendor publishes. */
  readonly signatures: readonly Signature[];
}

/**
 * A single matched signature in an OverlayReport.
 */
export interface SignatureRef {
  readonly kind: SignatureKind;
  readonly value: string;
  readonly locationHint: string;
}

/**
 * One detected vendor in an OverlayReport.
 */
export interface VendorHit {
  readonly vendor: string;
  readonly confidence: Confidence;
  readonly signaturesMatched: readonly SignatureRef[];
  readonly firstSeen: string;
  readonly lastVerified: string;
}

/**
 * Citations block always attached to an OverlayReport.
 */
export interface Citations {
  /** URL of the W3C-WAI Accessibility Overlay community position. */
  readonly w3cWaiOverlayPosition: string;
  /** URL of the OverlayFactsheet community statement. */
  readonly overlayFactsheet: string;
  /** ISO date the citation URLs were last manually verified. */
  readonly citationsLastVerified: string;
  /** Verbatim disclaimer string. */
  readonly disclaimer: string;
}

/**
 * Full detection report.
 */
export interface OverlayReport {
  readonly vendorsDetected: readonly VendorHit[];
  readonly citations: Citations;
  readonly scannedAt: string;
  readonly signaturesVersion: string;
}

/**
 * Options for detectOverlays().
 */
export interface DetectOptions {
  readonly fetcher?: (url: string) => Promise<string>;
  readonly confidenceFloor?: Confidence;
  readonly signatureSubset?: readonly string[];
  /** Injectable clock for deterministic tests. */
  readonly now?: () => string;
}

/**
 * Error thrown by detectOverlays() with a numeric `code` matching the
 * documented exit-code table (2 = input validation, 3 = fetcher
 * rejection, 4 = signature-registry integrity failure).
 */
export class OverlayDetectionError extends Error {
  public readonly code: 2 | 3 | 4;

  /**
   *
   */
  constructor(message: string, code: 2 | 3 | 4, options?: { cause?: unknown }) {
    super(message);
    this.name = 'OverlayDetectionError';
    this.code = code;
    if (options?.cause !== undefined) {
      (this as { cause?: unknown }).cause = options.cause;
    }
  }
}
