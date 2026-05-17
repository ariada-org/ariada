// SPDX-License-Identifier: EUPL-1.2
/**
 * Citation constants and disclaimer text.
 *
 * Both URLs are hard-coded; verification cadence is annual. The
 * policy is to link to canonical community statements and emit the
 * verbatim disclaimer below — no inline quoting of third-party text.
 * The disclaimer is verbatim and is tested byte-for-byte in
 * tests/unit/citations.test.ts.
 */

import type { Citations } from './types.js';

/**
 * Canonical URL of the W3C WAI Accessibility Overlay community
 * position page. Last manually verified on the date in
 * {@link CITATIONS_LAST_VERIFIED}.
 */
export const W3C_WAI_OVERLAY_POSITION =
  'https://www.w3.org/WAI/standards-guidelines/glossary/#accessibility-overlay';

/**
 * Canonical URL of the OverlayFactsheet community statement.
 */
export const OVERLAY_FACTSHEET = 'https://overlayfactsheet.com/';

/**
 * ISO date the URLs above were last manually verified.
 */
export const CITATIONS_LAST_VERIFIED = '2026-05-20';

/**
 * Verbatim disclaimer string emitted on every report. Do not edit
 * casually — the byte-for-byte form is asserted in citations tests
 * and consumed by downstream renderers.
 */
export const CITATION_DISCLAIMER =
  'Detection is mechanical pattern-matching. The fact a vendor is present does not by itself prove WCAG / EAA non-conformance. NOT LEGAL ADVICE.';

/**
 * Build the citations block. The block is always present in a report,
 * even when zero vendors are detected, so downstream renderers can
 * surface the W3C-WAI and OverlayFactsheet references as informational
 * context.
 */
export function buildCitations(): Citations {
  return {
    w3cWaiOverlayPosition: W3C_WAI_OVERLAY_POSITION,
    overlayFactsheet: OVERLAY_FACTSHEET,
    citationsLastVerified: CITATIONS_LAST_VERIFIED,
    disclaimer: CITATION_DISCLAIMER,
  };
}
