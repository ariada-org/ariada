// SPDX-License-Identifier: EUPL-1.2
/**
 * Detection orchestrator.
 *
 * Iterates the registry, runs each signature against the input HTML,
 * aggregates per-vendor hits, assigns confidence bands, applies the
 * caller-supplied `confidenceFloor`, and returns a structured
 * OverlayReport via the report formatter.
 *
 * Invariants:
 *   - No outbound network. URL input delegates to a caller-supplied
 *     fetcher; if no fetcher is provided the call fails with code 2.
 *   - Deterministic output under a fixed clock.
 *   - Word-boundary discipline — vendor name occurrences in operational
 *     email aliases or in the citation strings themselves do not match.
 */

import { computeConfidence, meetsFloor } from './confidence.js';
import { formatReport } from './report.js';
import { matchesGenericToolbar } from './signatures/generic-toolbar.js';
import { REGISTRY, VENDOR_IDS } from './signatures/index.js';
import type {
  Confidence,
  DetectOptions,
  OverlayReport,
  SignatureKind,
  SignatureRef,
  VendorHit,
  VendorSignature,
} from './types.js';
import { OverlayDetectionError } from './types.js';

const MAX_HTML_BYTES = 50 * 1024 * 1024; // 50 MB

function isHtmlInput(input: unknown): input is { html: string } {
  return (
    typeof input === 'object' &&
    input !== null &&
    'html' in input &&
    typeof (input as { html: unknown }).html === 'string'
  );
}

function isUrlInput(input: unknown): input is { url: string } {
  return (
    typeof input === 'object' &&
    input !== null &&
    'url' in input &&
    typeof (input as { url: unknown }).url === 'string'
  );
}

function validateUrl(url: string): boolean {
  try {
    // Throws on malformed input. We only require RFC 3986 absolute.
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Run one vendor's signatures over the input. Returns the matched
 * signature refs (possibly empty) plus the set of kinds matched.
 */
function runVendor(html: string, vendor: VendorSignature): {
  refs: SignatureRef[];
  kinds: Set<SignatureKind>;
} {
  const refs: SignatureRef[] = [];
  const kinds = new Set<SignatureKind>();

  // Generic-toolbar uses a custom matcher (keyword threshold), not a
  // single regex hit. Special-case it.
  if (vendor.id === 'generic-toolbar') {
    if (matchesGenericToolbar(html)) {
      const sig0 = vendor.signatures[0];
      if (sig0 !== undefined) {
        refs.push({
          kind: sig0.kind,
          value: sig0.label,
          locationHint: sig0.locationHint,
        });
        kinds.add(sig0.kind);
      }
    }
    return { refs, kinds };
  }

  for (const sig of vendor.signatures) {
    let matched = false;
    try {
      matched = sig.pattern.test(html);
    } catch {
      // Defensive — should never happen with linear-time regexes,
      // but if a future regex throws we skip rather than crash.
      matched = false;
    }
    if (matched) {
      refs.push({
        kind: sig.kind,
        value: sig.label,
        locationHint: sig.locationHint,
      });
      kinds.add(sig.kind);
    }
  }
  return { refs, kinds };
}

async function resolveHtml(
  input: { html: string } | { url: string },
  options: DetectOptions,
): Promise<string> {
  if (isHtmlInput(input)) {
    if (input.html.length === 0) {
      throw new OverlayDetectionError('Empty html input.', 2);
    }
    if (input.html.length > MAX_HTML_BYTES) {
      throw new OverlayDetectionError(
        `html input exceeds ${MAX_HTML_BYTES} bytes.`,
        2,
      );
    }
    return input.html;
  }
  if (isUrlInput(input)) {
    if (!validateUrl(input.url)) {
      throw new OverlayDetectionError(`Invalid url: ${input.url}`, 2);
    }
    if (options.fetcher === undefined) {
      throw new OverlayDetectionError(
        'url input requires options.fetcher.',
        2,
      );
    }
    try {
      const html = await options.fetcher(input.url);
      if (typeof html !== 'string' || html.length === 0) {
        throw new OverlayDetectionError(
          'Fetcher returned empty or non-string body.',
          3,
        );
      }
      return html;
    } catch (cause) {
      if (cause instanceof OverlayDetectionError) throw cause;
      throw new OverlayDetectionError('Fetcher rejected.', 3, { cause });
    }
  }
  throw new OverlayDetectionError('Must supply { html } or { url }.', 2);
}

/**
 * Detect third-party accessibility-overlay vendors in the supplied
 * HTML and return a structured machine-readable report.
 *
 * Detection only — does NOT recommend removal, does NOT auto-disable,
 * does NOT issue a WCAG / EAA non-conformance verdict.
 */
export async function detectOverlays(
  input: { html: string } | { url: string },
  options: DetectOptions = {},
): Promise<OverlayReport> {
  // Build-time integrity check.
  if (REGISTRY.length === 0) {
    throw new OverlayDetectionError('Signature registry is empty.', 4);
  }

  // Validate optional signatureSubset.
  if (options.signatureSubset !== undefined) {
    for (const id of options.signatureSubset) {
      if (!VENDOR_IDS.has(id)) {
        throw new OverlayDetectionError(`Unknown vendor id: ${id}`, 2);
      }
    }
  }

  const html = await resolveHtml(input, options);

  const activeRegistry = options.signatureSubset === undefined
    ? REGISTRY
    : REGISTRY.filter((v) => options.signatureSubset!.includes(v.id));

  const hits: VendorHit[] = [];
  for (const vendor of activeRegistry) {
    const { refs, kinds } = runVendor(html, vendor);
    if (refs.length === 0) continue;
    const confidence = computeConfidence(vendor, kinds);
    hits.push({
      vendor: vendor.id,
      confidence,
      signaturesMatched: Object.freeze(refs),
      firstSeen: vendor.firstSeen,
      lastVerified: vendor.lastVerified,
    });
  }

  const floor: Confidence = options.confidenceFloor ?? 'low';
  const filtered = hits.filter((h) => meetsFloor(h.confidence, floor));

  return formatReport(filtered, options.now);
}
