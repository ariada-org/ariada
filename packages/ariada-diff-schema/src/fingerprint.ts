// SPDX-License-Identifier: EUPL-1.2
//
// Finding-fingerprint canonical pre-image (§3.1).
//
// The fingerprint is the deterministic identity that lets two findings —
// possibly emitted by different scan invocations on different commits —
// match against each other. Determinism across implementations is
// REQUIRED; an independent re-implementation MUST produce byte-identical
// hashes for byte-identical inputs.
//
// Construction:
//   1. Project the Finding to the fingerprint-relevant subset.
//   2. Normalise the selector via `normaliseSelector`.
//   3. SHA-256 the AX-tree accessible name, retain 16-char hex prefix.
//   4. RFC 8785 JCS canonicalise the projected object.
//   5. UTF-8 encode and SHA-256, lowercase hex output.

import { sha256Hex } from './internal/hash.js';
import { canonicalize } from './internal/jcs-encode.js';
import {
  normaliseSelector,
  type SelectorNormaliseOptions,
} from './selector-normalise.js';

/** Severity classification carried on every accessibility finding. */
export type Severity = 'critical' | 'serious' | 'moderate' | 'minor';

/**
 * Accessibility finding shape consumed by fingerprint construction. Only
 * fingerprint-relevant fields are required; downstream code may carry
 * additional fields on the same object.
 */
export interface Finding {
  /** Rule identifier, e.g. `wcag2/2.4.7`. */
  ruleId: string;
  /** WCAG success-criterion number, e.g. `2.4.7`. Optional. */
  wcagSc?: string | null;
  /** Jurisdiction tags (sorted before hashing). */
  jurisdictionTags: readonly string[];
  /** Severity classification. */
  severity: Severity;
  /** Raw DOM selector (will be normalised before hashing). */
  selector: string;
  /** ARIA role from the AX tree. Optional. */
  axTreeRole?: string | null;
  /** Accessible name from the AX tree. Optional. */
  axTreeName?: string | null;
}

/** Configuration knobs (§3.2 BaselinePolicy.fingerprint_options). */
export interface FingerprintOptions {
  /** Beyond this depth, nth-child indices are generalised. Default 4. */
  selectorDepth?: number;
  /** Hex prefix length retained from the AX-tree name SHA-256. Default 16. */
  nameHashLength?: number;
  /** When true, strips additional ID patterns (per-org override). Default false. */
  strictIdRegex?: boolean;
}

const DEFAULT_NAME_HASH_LENGTH = 16;
const DEFAULT_SELECTOR_DEPTH = 4;

/**
 * Compute the canonical fingerprint of a Finding. Returns 64-char
 * lowercase hex (SHA-256).
 */
export function computeFindingFingerprint(
  finding: Finding,
  options?: FingerprintOptions,
): string {
  const nameHashLength = options?.nameHashLength ?? DEFAULT_NAME_HASH_LENGTH;
  const selectorDepth = options?.selectorDepth ?? DEFAULT_SELECTOR_DEPTH;
  const strictIdRegex = options?.strictIdRegex ?? false;

  const selOpts: SelectorNormaliseOptions = {
    selectorDepth,
    strictIdRegex,
  };

  const projected = {
    rule_id: finding.ruleId,
    wcag_sc: finding.wcagSc ?? null,
    jurisdiction_tags: [...finding.jurisdictionTags].sort(),
    severity: finding.severity,
    selector_normalised: normaliseSelector(finding.selector, selOpts),
    ax_tree_role: finding.axTreeRole ?? null,
    ax_tree_name_hash:
      finding.axTreeName != null && finding.axTreeName !== ''
        ? sha256Hex(finding.axTreeName).slice(0, nameHashLength)
        : null,
  };

  const canonical = canonicalize(projected);
  return sha256Hex(canonical);
}

/**
 * Compute fingerprints for an array of findings. Returns a parallel array
 * of 64-char hex strings.
 */
export function computeFingerprints(
  findings: readonly Finding[],
  options?: FingerprintOptions,
): string[] {
  return findings.map((f) => computeFindingFingerprint(f, options));
}
