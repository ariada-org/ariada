// SPDX-License-Identifier: EUPL-1.2
/**
 * `@ariada-org/anti-overlay` — public entry point.
 *
 * Detection-only third-party accessibility-overlay surface. Returns
 * a machine-readable report with verbatim W3C-WAI and OverlayFactsheet
 * citations attached. Does NOT recommend removal, does NOT auto-fail
 * a scan, does NOT issue a WCAG / EAA verdict.
 *
 * @see ../README.md
 */

export { detectOverlays } from './detect.js';
export {
  W3C_WAI_OVERLAY_POSITION,
  OVERLAY_FACTSHEET,
  CITATIONS_LAST_VERIFIED,
  CITATION_DISCLAIMER,
  buildCitations,
} from './citations.js';
export { SIGNATURES_VERSION } from './report.js';
export { REGISTRY, VENDOR_IDS } from './signatures/index.js';
export { computeConfidence, meetsFloor } from './confidence.js';
export { OverlayDetectionError } from './types.js';
export type {
  Citations,
  Confidence,
  DetectOptions,
  OverlayReport,
  Signature,
  SignatureKind,
  SignatureRef,
  VendorHit,
  VendorSignature,
} from './types.js';
