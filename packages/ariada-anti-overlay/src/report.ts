// SPDX-License-Identifier: EUPL-1.2
/**
 * Report formatter.
 *
 * Wraps a list of VendorHits into the OverlayReport surface with the
 * Citations block always attached. The `signaturesVersion` is derived
 * from the package version baseline; consumers can pin against a
 * known registry snapshot.
 */

import { buildCitations } from './citations.js';
import type { OverlayReport, VendorHit } from './types.js';

/**
 * Major.minor pin matching package.json. Updated alongside semver
 * bumps when the registry changes.
 */
export const SIGNATURES_VERSION = '0.1';

/**
 * Build the OverlayReport from an aggregated hit list.
 *
 * @param hits Filtered vendor hits (already passed through confidence
 *   floor in detect.ts).
 * @param now Injectable clock for deterministic snapshots.
 */
export function formatReport(
  hits: readonly VendorHit[],
  now?: () => string,
): OverlayReport {
  const scannedAt = now !== undefined ? now() : new Date().toISOString();
  return {
    vendorsDetected: Object.freeze([...hits]),
    citations: buildCitations(),
    scannedAt,
    signaturesVersion: SIGNATURES_VERSION,
  };
}
