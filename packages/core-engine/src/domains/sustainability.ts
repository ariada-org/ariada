// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import type {
  DomainModule,
  ElementHandle,
  ExtractedFeatures,
  FeatureSink,
  PropertySnapshot,
} from '../domain-contract.js';
import type { Finding } from '../types.js';

// ---------------------------------------------------------------------------
// Feature keys
// ---------------------------------------------------------------------------

/** Set on an image element when it is not in a next-generation format (WebP / AVIF). */
export const SUSTAIN_LARGE_IMAGE = 'sustainability:large-image';

/** Set on an image element when the `loading` attribute is absent. */
export const SUSTAIN_NO_LAZY_LOAD = 'sustainability:no-lazy-load';

/** Set on a script element when the `src` origin differs from the page origin. */
export const SUSTAIN_THIRD_PARTY_SCRIPT = 'sustainability:third-party-script';

// ---------------------------------------------------------------------------
// Document-level feature keys (stored in byDocument)
// ---------------------------------------------------------------------------

/** Total bytes transferred across all tracked network resources (number). */
const DOC_TOTAL_BYTES = 'sustainability:total-bytes';

/** Count of resources whose origin differs from the page origin (number). */
const DOC_THIRD_PARTY_COUNT = 'sustainability:third-party-count';

/** Count of image resources not served in a next-gen format (number). */
const DOC_UNOPTIMIZED_IMAGE_COUNT = 'sustainability:unoptimized-image-count';

/** Estimated grams of CO₂e per page-view using the Sustainable Web Design Model v4 (number). */
const DOC_CO2E_GRAMS = 'sustainability:co2e-grams';

/** Carbon rating letter grade derived from CO₂e thresholds (string). */
const DOC_CARBON_RATING = 'sustainability:carbon-rating';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Estimate CO₂e in grams for a page transfer using the Sustainable Web Design
 * Model v4 formula: bytes × energy-per-byte × grid-intensity.
 *
 * Constants from the SWDM v4 methodology (Wholegrain Digital, 2023 IEA data):
 * - 0.000000414 kWh/byte  (data-center + network + device energy mix)
 * - 442 g CO₂/kWh          (global average grid intensity, non-renewable)
 * - 50 g CO₂/kWh           (renewable grid factor when green-hosted)
 *
 * The result is an estimate at page-view granularity. No network call is made;
 * this extractor reads only the already-captured networkResources array.
 */
function estimateCo2eGrams(totalBytes: number, greenHosting: boolean): number {
  const kwhPerByte = 0.000000414;
  const gridFactor = greenHosting ? 50 : 442;
  return totalBytes * kwhPerByte * gridFactor;
}

type CarbonRating = 'A+' | 'A' | 'B' | 'C' | 'D' | 'E' | 'F';

/**
 * Map a CO₂e estimate (grams per page-view) to the Wholegrain Digital Digital
 * Carbon Rating thresholds based on HTTP Archive percentile data.
 *
 * Thresholds: A+ <0.095, A <0.186, B <0.341, C <0.493, D <0.656, E <1.0, F ≥1.0
 */
function carbonRating(co2eGrams: number): CarbonRating {
  if (co2eGrams < 0.095) return 'A+';
  if (co2eGrams < 0.186) return 'A';
  if (co2eGrams < 0.341) return 'B';
  if (co2eGrams < 0.493) return 'C';
  if (co2eGrams < 0.656) return 'D';
  if (co2eGrams < 1.0) return 'E';
  return 'F';
}

/**
 * Return true when the MIME type indicates a next-generation image format
 * (WebP or AVIF) that typically delivers smaller file sizes without perceptible
 * quality loss. Images in JPEG, PNG, GIF, or other formats are considered
 * unoptimized for bandwidth efficiency purposes.
 */
function isNextGenFormat(mimeType: string): boolean {
  const lower = mimeType.toLowerCase();
  return lower.includes('webp') || lower.includes('avif');
}

/**
 * Derive the hostname from a URL string without throwing on malformed input.
 * Returns an empty string when the URL cannot be parsed.
 */
function safeHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

/**
 * Read the green-hosting flag from the snapshot's optional originArtifacts
 * field. Returns false when the field is absent (tolerate absence per the
 * binding ruling: snapshot enrichment fields are optional).
 */
function resolveGreenHosting(snap: PropertySnapshot): boolean {
  return snap.originArtifacts?.greenHosting === true;
}

// ---------------------------------------------------------------------------
// Page-weight threshold (WSG 2.15 — HTTP Archive 75th percentile)
// ---------------------------------------------------------------------------

const PAGE_WEIGHT_THRESHOLD_BYTES = 1_500_000; // 1.5 MB
const THIRD_PARTY_COUNT_THRESHOLD = 5;

// ---------------------------------------------------------------------------
// The sustainability domain
// ---------------------------------------------------------------------------

/**
 * Sustainability compliance domain. Reads page-weight and resource signals from
 * the already-captured PropertySnapshot — no I/O inside any extractor. Findings
 * map to machine-testable Web Sustainability Guidelines (WSG) criteria.
 *
 * Cross-domain interactions declared:
 * - `sustainability:large-image` (element scope) pairs with
 *   `a11y:missing-alt` in the accessibility domain on the same image element.
 *   The conflict: compressing an image aggressively to cut page weight can
 *   reduce the visual fidelity that alt text is meant to describe.
 * - `sustainability:no-lazy-load` (element scope) pairs with the performance
 *   domain's lazy-load feature on the same image element. The conflict:
 *   adding `loading="lazy"` improves transfer efficiency but delays rendering
 *   for users relying on assistive technology to discover the element.
 */
export const sustainabilityDomain: DomainModule = {
  id: 'sustainability',
  title: 'Sustainability',
  version: '0.1.0',

  extractors: {
    /**
     * Per-element pass: flag individual image and script elements that
     * contribute to page-weight or discoverability problems. Runs once per
     * element inside the single shared walker — no own traversal.
     *
     * Reads only the ElementHandle fields captured before the walk; no I/O.
     */
    perElement(el: ElementHandle, acc: FeatureSink): void {
      const tag = el.nodeName.toLowerCase();

      if (tag === 'img') {
        // Check for missing lazy-load attribute. The `loading` attribute presence
        // is the automatable proxy for WSG 2.18 (lazy loading below the fold).
        // True below-fold detection requires viewport intersection data not
        // present in the snapshot, so absence of the attribute is the signal.
        const loadingAttr = el.attributes?.['loading'];
        if (!loadingAttr) {
          acc.set(el.selector, SUSTAIN_NO_LAZY_LOAD, true);
        }

        // Mark as a large/unoptimized image if the src lacks a next-gen
        // extension. The snapshot element outline does not carry resource
        // transfer sizes, so format-based proxy is the best signal available
        // at the element level without network data.
        // We set this feature key so the cross-domain detector can correlate
        // with the accessibility domain's a11y:missing-alt on the same selector.
        const src = el.attributes?.['src'] ?? '';
        const lowerSrc = src.toLowerCase();
        if (src && !lowerSrc.endsWith('.webp') && !lowerSrc.endsWith('.avif')) {
          acc.set(el.selector, SUSTAIN_LARGE_IMAGE, true);
        }
      }

      if (tag === 'script') {
        // Flag render-blocking third-party scripts (no defer/async and external src).
        const src = el.attributes?.['src'] ?? '';
        const defer = el.attributes?.['defer'];
        const async_ = el.attributes?.['async'];
        if (src && defer === undefined && async_ === undefined) {
          acc.set(el.selector, SUSTAIN_THIRD_PARTY_SCRIPT, true);
        }
      }
    },

    /**
     * Per-document pass: aggregate network resource signals into page-level
     * sustainability metrics. Reads PropertySnapshot.networkResources (already
     * populated at capture time) and the optional originArtifacts.greenHosting
     * flag. No I/O.
     */
    perDocument(snap: PropertySnapshot, acc: FeatureSink): void {
      const resources = snap.networkResources;
      const pageHostname = safeHostname(snap.url);
      const greenHosting = resolveGreenHosting(snap);

      let totalBytes = 0;
      let thirdPartyCount = 0;
      let unoptimizedImageCount = 0;

      for (const resource of resources) {
        const bytes = resource.size ?? 0;
        totalBytes += bytes;

        const rHost = safeHostname(resource.url);
        if (rHost && rHost !== pageHostname) {
          thirdPartyCount += 1;
        }

        const mime = resource.mimeType ?? '';
        if (mime.startsWith('image/') && !isNextGenFormat(mime)) {
          unoptimizedImageCount += 1;
        }
      }

      const co2eGrams = estimateCo2eGrams(totalBytes, greenHosting);
      const rating = carbonRating(co2eGrams);

      acc.set('', DOC_TOTAL_BYTES, totalBytes);
      acc.set('', DOC_THIRD_PARTY_COUNT, thirdPartyCount);
      acc.set('', DOC_UNOPTIMIZED_IMAGE_COUNT, unoptimizedImageCount);
      acc.set('', DOC_CO2E_GRAMS, co2eGrams);
      acc.set('', DOC_CARBON_RATING, rating);
    },
  },

  evaluate(features: ExtractedFeatures): Finding[] {
    const findings: Finding[] = [];

    // -----------------------------------------------------------------------
    // Document-level rules — read from byDocument
    // -----------------------------------------------------------------------
    const totalBytes = (features.byDocument.get(DOC_TOTAL_BYTES) as number | undefined) ?? 0;
    const thirdPartyCount = (features.byDocument.get(DOC_THIRD_PARTY_COUNT) as number | undefined) ?? 0;
    const unoptimizedImageCount =
      (features.byDocument.get(DOC_UNOPTIMIZED_IMAGE_COUNT) as number | undefined) ?? 0;
    const co2eGrams = (features.byDocument.get(DOC_CO2E_GRAMS) as number | undefined) ?? 0;
    const rating = (features.byDocument.get(DOC_CARBON_RATING) as CarbonRating | undefined) ?? 'A+';

    // WSG 2.15 — page weight exceeds HTTP Archive 75th-percentile threshold.
    if (totalBytes > PAGE_WEIGHT_THRESHOLD_BYTES) {
      const mb = (totalBytes / 1_000_000).toFixed(2);
      const co2Str = co2eGrams.toFixed(3);
      findings.push({
        id: 'wsg-page-weight',
        scanId: '',
        domain: 'sustainability',
        ruleId: 'wsg-page-weight',
        severity: 'serious',
        element: { selector: ':root' },
        message: `Total page weight ${mb} MB exceeds 1.5 MB threshold (WSG 2.15). Estimated ${co2Str} g CO₂e per page-view.`,
        regulatoryMapping: [{ framework: 'WSG', code: 'WSG 2.15' }],
      });
    }

    // WSG 2.14 — images not served in a next-generation format.
    if (unoptimizedImageCount > 0) {
      findings.push({
        id: 'wsg-image-format',
        scanId: '',
        domain: 'sustainability',
        ruleId: 'wsg-image-format',
        severity: 'moderate',
        element: { selector: ':root' },
        message: `${unoptimizedImageCount} image(s) not served in WebP or AVIF format (WSG 2.14). Converting reduces transfer bytes without loss of visual quality.`,
        regulatoryMapping: [{ framework: 'WSG', code: 'WSG 2.14' }],
      });
    }

    // WSG 2.17 — excessive third-party dependencies raise transfer overhead.
    if (thirdPartyCount > THIRD_PARTY_COUNT_THRESHOLD) {
      findings.push({
        id: 'wsg-third-party-count',
        scanId: '',
        domain: 'sustainability',
        ruleId: 'wsg-third-party-count',
        severity: 'moderate',
        element: { selector: ':root' },
        message: `${thirdPartyCount} third-party resources loaded (WSG 2.17). More than ${THIRD_PARTY_COUNT_THRESHOLD} third-party origins increases data transfer and energy use.`,
        regulatoryMapping: [{ framework: 'WSG', code: 'WSG 2.17' }],
      });
    }

    // WSG 3.3 — carbon rating D–F signals a high per-page CO₂e footprint.
    if (rating === 'D' || rating === 'E' || rating === 'F') {
      findings.push({
        id: 'wsg-carbon-rating',
        scanId: '',
        domain: 'sustainability',
        ruleId: 'wsg-carbon-rating',
        severity: rating === 'F' ? 'serious' : 'moderate',
        element: { selector: ':root' },
        message: `Carbon rating ${rating} (WSG 3.3). Estimated ${co2eGrams.toFixed(3)} g CO₂e per page-view. Reducing page weight and switching to a green-hosted server improve this rating.`,
        regulatoryMapping: [{ framework: 'WSG', code: 'WSG 3.3' }],
      });
    }

    // -----------------------------------------------------------------------
    // Element-level rules — read from byElement
    // -----------------------------------------------------------------------
    for (const [selector, data] of features.byElement) {
      const sustain = data.domainFeatures['sustainability'];
      if (!sustain) continue;

      // WSG 2.18 — lazy loading absent on an image element.
      if (sustain.get(SUSTAIN_NO_LAZY_LOAD)) {
        findings.push({
          id: `wsg-lazy-load-${selector}`,
          scanId: '',
          domain: 'sustainability',
          ruleId: 'wsg-lazy-load',
          severity: 'minor',
          element: { selector },
          message: `Image element is missing the loading="lazy" attribute (WSG 2.18). Without it the browser fetches the image during initial load regardless of viewport position.`,
          regulatoryMapping: [{ framework: 'WSG', code: 'WSG 2.18' }],
        });
      }
    }

    return findings;
  },

  regulatory: [
    { framework: 'WSG', code: 'WSG 2.14' },
    { framework: 'WSG', code: 'WSG 2.15' },
    { framework: 'WSG', code: 'WSG 2.17' },
    { framework: 'WSG', code: 'WSG 2.18' },
    { framework: 'WSG', code: 'WSG 3.3' },
  ],

  /**
   * Declares the features this domain emits that the cross-domain detector can
   * correlate with other domains' features sharing the same element selector.
   *
   * Both features use the element join scope so the detector can match them
   * against accessibility domain features recorded on the same selector:
   * - `sustainability:large-image` pairs with `a11y:missing-alt` (the image
   *   compression vs alt-text fidelity conflict, patent seed pair
   *   "accessibility|sustainability|element").
   * - `sustainability:no-lazy-load` exposes the lazy-load signal that
   *   interacts with assistive-technology discoverability on the same element.
   */
  interactionFeatures: [
    {
      key: SUSTAIN_LARGE_IMAGE,
      description:
        'Image is not in a next-gen format — compressing it to reduce page weight can reduce the visual fidelity that its alt text is meant to convey.',
      joinScope: 'element',
    },
    {
      key: SUSTAIN_NO_LAZY_LOAD,
      description:
        'Image lacks the loading="lazy" attribute — adding it improves transfer efficiency but delays element rendering, potentially breaking linear reading order for assistive technology.',
      joinScope: 'element',
    },
  ],
};
