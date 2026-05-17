// SPDX-License-Identifier: EUPL-1.2
/**
 * Confidence-band rubric.
 *
 * Given the set of matched signature kinds for one vendor:
 *   - high   = at least one network-anchored signature (script-src OR
 *              iframe-src) OR three-or-more DOM/attribute/global-js
 *              signatures
 *   - medium = exactly two DOM/attribute/global-js/class-prefix
 *              signatures
 *   - low    = exactly one DOM/attribute/global-js/class-prefix
 *              signature
 *
 * A vendor may carry an explicit `confidenceCap` which clamps the
 * result downward (e.g. the accessibe-iframe variant caps at `medium`
 * even when network-anchored).
 */

import type { Confidence, SignatureKind, VendorSignature } from './types.js';

const NETWORK_ANCHORED: ReadonlySet<SignatureKind> = new Set<SignatureKind>(['script-src', 'iframe-src']);

const RANK: Record<Confidence, number> = { low: 0, medium: 1, high: 2 };

/**
 * Compute the confidence band for a vendor given the set of matched
 * signature kinds. The `matchedKinds` argument is a set — duplicate
 * kinds count once.
 */
export function computeConfidence(
  vendor: VendorSignature,
  matchedKinds: ReadonlySet<SignatureKind>,
): Confidence {
  const totalMatches = matchedKinds.size;
  if (totalMatches === 0) {
    // Should never reach here for a real hit; defensive.
    return 'low';
  }

  const hasNetwork = [...matchedKinds].some((k) => NETWORK_ANCHORED.has(k));

  let band: Confidence;
  if (hasNetwork) {
    band = 'high';
  } else if (totalMatches >= 3) {
    band = 'high';
  } else if (totalMatches === 2) {
    band = 'medium';
  } else {
    band = 'low';
  }

  // Apply vendor-level cap if present (e.g. accessibe-iframe → medium).
  if (vendor.confidenceCap !== undefined && RANK[band] > RANK[vendor.confidenceCap]) {
    band = vendor.confidenceCap;
  }

  return band;
}

/**
 * Return true when `band` meets or exceeds the floor.
 */
export function meetsFloor(band: Confidence, floor: Confidence): boolean {
  return RANK[band] >= RANK[floor];
}
