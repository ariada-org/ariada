// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import type {
  DomainModule,
  ElementHandle,
  ExtractedFeatures,
  FeatureSink,
  InteractionFeatureSpec,
  PropertySnapshot,
} from '../domain-contract.js';
import type { Finding } from '../types.js';

// ---------------------------------------------------------------------------
// Domain identifier
// ---------------------------------------------------------------------------

/** Stable domain id — used as the `domain` field on every Finding this module emits. */
const DOMAIN_ID = 'structured-data';

// ---------------------------------------------------------------------------
// Feature keys
// ---------------------------------------------------------------------------

/**
 * Set on an IMG element during the shared element pass. Signals that this
 * element is a candidate schema image anchor — enabling the cross-domain
 * detector to join it with the accessibility domain's missing-alt feature on
 * the same element selector.
 */
export const SD_IMAGE_ANCHOR = 'sd:image-anchor';

/**
 * Set on the document during the shared pass. The value is a JSON-serialised
 * array of all ImageObject entries found in JSON-LD blocks: each entry carries
 * a boolean `hasDescription` and an optional `contentUrl` that can be used to
 * correlate back to a DOM image element.
 */
export const SD_SCHEMA_BLOCKS = 'sd:schema-blocks';

/**
 * Set on the document during the shared pass. The value is the count of
 * ImageObject entries that lack a `description` property — used by `evaluate`
 * to produce `sd-image-object-description` findings.
 */
export const SD_IMAGE_OBJECT_MISSING_DESCRIPTION_COUNT =
  'sd:image-object-missing-description-count';

// ---------------------------------------------------------------------------
// Rule IDs
// ---------------------------------------------------------------------------

export const RULE_IMAGE_OBJECT_DESCRIPTION = 'sd-image-object-description';
export const RULE_PARSE_ERROR = 'sd-parse-error';
export const RULE_PRODUCT_REQUIRED = 'sd-product-required';
export const RULE_PRICE_VALIDITY = 'sd-price-validity';
export const RULE_ARTICLE_REQUIRED = 'sd-article-required';

// ---------------------------------------------------------------------------
// Internal types for extracted schema data
// ---------------------------------------------------------------------------

/** Parsed representation of one JSON-LD block from the document. */
interface SchemaBlock {
  blockIndex: number;
  /** Schema type(s); may be an array in the source. */
  types: string[];
  id?: string;
  /** Raw top-level properties of the schema object. */
  properties: Record<string, unknown>;
  /** Whether JSON.parse of this block succeeded. */
  valid: boolean;
}

// ---------------------------------------------------------------------------
// JSON-LD parsing helpers (pure, synchronous, no I/O)
// ---------------------------------------------------------------------------

/**
 * Extract all `<script type="application/ld+json">` blocks from an HTML string.
 * Returns each block as a raw JSON string alongside its position index.
 * No DOM parser is used — the function locates script tags by regex over the
 * captured HTML, which is a reliable approach for the structured fragments
 * present in PropertySnapshot.html.
 */
function extractJsonLdBlocks(html: string): Array<{ index: number; raw: string }> {
  const result: Array<{ index: number; raw: string }> = [];
  // Match <script type="application/ld+json">...</script> (non-greedy, case-insensitive).
  const re =
    /<script[^>]+type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  let index = 0;
  while ((match = re.exec(html)) !== null) {
    const raw = match[1] ?? '';
    result.push({ index, raw });
    index += 1;
  }
  return result;
}

/**
 * Parse a single raw JSON-LD string into a `SchemaBlock`. Returns a block with
 * `valid: false` when the string is not valid JSON.
 */
function parseSchemaBlock(raw: string, blockIndex: number): SchemaBlock {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.trim());
  } catch {
    return { blockIndex, types: [], properties: {}, valid: false };
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { blockIndex, types: [], properties: {}, valid: false };
  }

  const obj = parsed as Record<string, unknown>;
  const typeRaw = obj['@type'];
  const types: string[] =
    typeof typeRaw === 'string'
      ? [typeRaw]
      : Array.isArray(typeRaw)
        ? (typeRaw as unknown[]).filter((t): t is string => typeof t === 'string')
        : [];

  const idRaw = typeof obj['@id'] === 'string' ? obj['@id'] : undefined;

  // Shallow copy of properties, excluding JSON-LD framing keys.
  const properties: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (k === '@type' || k === '@id' || k === '@context') continue;
    properties[k] = v;
  }

  const block: SchemaBlock = { blockIndex, types, properties, valid: true };
  if (idRaw !== undefined) block.id = idRaw;
  return block;
}

/**
 * Parse all JSON-LD blocks from a captured HTML string. Blocks with parse
 * errors are retained (with `valid: false`) so the rule engine can flag them.
 */
function parseAllSchemaBlocks(html: string): SchemaBlock[] {
  const rawBlocks = extractJsonLdBlocks(html);
  return rawBlocks.map(({ index, raw }) => parseSchemaBlock(raw, index));
}

// ---------------------------------------------------------------------------
// Rule helpers (pure, deterministic)
// ---------------------------------------------------------------------------

/**
 * Check whether a schema type string matches a given Schema.org type. The
 * comparison strips an optional `https://schema.org/` or `http://schema.org/`
 * prefix so both forms are accepted.
 */
function isType(block: SchemaBlock, typeName: string): boolean {
  return block.types.some((t) => {
    const bare = t.replace(/^https?:\/\/schema\.org\//, '');
    return bare === typeName;
  });
}

/**
 * Return the value of a property, looking up both its plain name and its
 * full Schema.org IRI form.
 */
function prop(block: SchemaBlock, name: string): unknown {
  if (Object.prototype.hasOwnProperty.call(block.properties, name)) {
    return block.properties[name];
  }
  const iri = `https://schema.org/${name}`;
  if (Object.prototype.hasOwnProperty.call(block.properties, iri)) {
    return block.properties[iri];
  }
  return undefined;
}

/** True when a property exists and is a non-empty string or non-null object. */
function hasProperty(block: SchemaBlock, name: string): boolean {
  const value = prop(block, name);
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  return true;
}

/**
 * True when a date string is in the past relative to the current time. Accepts
 * ISO-8601 date strings (YYYY-MM-DD or full datetime).
 */
function isDateInPast(dateStr: unknown): boolean {
  if (typeof dateStr !== 'string') return false;
  try {
    return new Date(dateStr).getTime() < Date.now();
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Selector helpers
// ---------------------------------------------------------------------------

/**
 * CSS selector that targets the Nth JSON-LD script block on the page (1-based).
 * Used as the `element.selector` on findings that relate to a whole schema
 * block rather than a specific DOM element.
 */
function jsonLdBlockSelector(blockIndex: number): string {
  return `script[type="application/ld+json"]:nth-of-type(${blockIndex + 1})`;
}

// ---------------------------------------------------------------------------
// Rule: sd-parse-error
// ---------------------------------------------------------------------------

function ruleParseError(
  blocks: SchemaBlock[],
  scanId: string,
): Finding[] {
  const findings: Finding[] = [];
  for (const block of blocks) {
    if (!block.valid) {
      findings.push({
        id: `${RULE_PARSE_ERROR}-block-${block.blockIndex}`,
        scanId,
        domain: DOMAIN_ID,
        ruleId: RULE_PARSE_ERROR,
        severity: 'critical',
        element: { selector: jsonLdBlockSelector(block.blockIndex) },
        message: `JSON-LD block ${block.blockIndex} is not valid JSON and cannot be interpreted by search engines`,
        regulatoryMapping: [],
      });
    }
  }
  return findings;
}

// ---------------------------------------------------------------------------
// Rule: sd-image-object-description
// ---------------------------------------------------------------------------

/**
 * Check ImageObject blocks for a missing `description` property. Emitted at
 * `moderate` severity because it is an interaction signal (shared with the
 * accessibility missing-alt finding) rather than a standalone blocker.
 */
function ruleImageObjectDescription(
  blocks: SchemaBlock[],
  scanId: string,
): Finding[] {
  const findings: Finding[] = [];
  for (const block of blocks) {
    if (!block.valid) continue;
    if (!isType(block, 'ImageObject')) continue;
    if (!hasProperty(block, 'description')) {
      const contentUrl = prop(block, 'contentUrl') ?? prop(block, 'url');
      const selectorHint =
        typeof contentUrl === 'string' && contentUrl.length > 0
          ? `img[src="${contentUrl}"]`
          : jsonLdBlockSelector(block.blockIndex);
      findings.push({
        id: `${RULE_IMAGE_OBJECT_DESCRIPTION}-${block.blockIndex}`,
        scanId,
        domain: DOMAIN_ID,
        ruleId: RULE_IMAGE_OBJECT_DESCRIPTION,
        severity: 'moderate',
        element: { selector: selectorHint },
        message: 'ImageObject in structured data is missing a description property',
        regulatoryMapping: [],
      });
    }
  }
  return findings;
}

// ---------------------------------------------------------------------------
// Rule: sd-product-required
// ---------------------------------------------------------------------------

/**
 * Required properties for a Product rich result per Google's specification.
 * A product must have a name, image, description, and an Offer with price and
 * currency; sku and availability are recommended.
 */
const PRODUCT_REQUIRED_FIELDS = ['name', 'image', 'description'] as const;
const OFFER_REQUIRED_FIELDS = ['price', 'priceCurrency'] as const;

/** Extract the Offer object from a Product block, or null when absent/malformed. */
function extractOffer(block: SchemaBlock): Record<string, unknown> | null {
  const offersRaw = prop(block, 'offers');
  if (
    offersRaw !== null &&
    offersRaw !== undefined &&
    typeof offersRaw === 'object' &&
    !Array.isArray(offersRaw)
  ) {
    return offersRaw as Record<string, unknown>;
  }
  return null;
}

/** Emit findings for missing Offer fields and expired/absent priceValidUntil. */
function checkOffer(
  block: SchemaBlock,
  offer: Record<string, unknown>,
  scanId: string,
): Finding[] {
  const findings: Finding[] = [];
  const sel = jsonLdBlockSelector(block.blockIndex);

  for (const field of OFFER_REQUIRED_FIELDS) {
    const val = offer[field];
    const present =
      val !== undefined &&
      val !== null &&
      (typeof val !== 'string' || val.trim().length > 0);
    if (!present) {
      findings.push({
        id: `${RULE_PRODUCT_REQUIRED}-${block.blockIndex}-offers-${field}`,
        scanId,
        domain: DOMAIN_ID,
        ruleId: RULE_PRODUCT_REQUIRED,
        severity: 'serious',
        element: { selector: sel },
        message: `Product offers is missing required property "${field}" needed for rich results`,
        regulatoryMapping: [],
      });
    }
  }

  const priceValidUntil = offer['priceValidUntil'];
  if (priceValidUntil === undefined || priceValidUntil === null) {
    findings.push({
      id: `${RULE_PRICE_VALIDITY}-${block.blockIndex}-absent`,
      scanId,
      domain: DOMAIN_ID,
      ruleId: RULE_PRICE_VALIDITY,
      severity: 'critical',
      element: { selector: sel },
      message:
        'Product offers is missing a "priceValidUntil" date; search engines may demote or remove this rich result',
      regulatoryMapping: [],
    });
  } else if (isDateInPast(priceValidUntil)) {
    findings.push({
      id: `${RULE_PRICE_VALIDITY}-${block.blockIndex}-expired`,
      scanId,
      domain: DOMAIN_ID,
      ruleId: RULE_PRICE_VALIDITY,
      severity: 'critical',
      element: { selector: sel },
      message: `Product offers "priceValidUntil" date (${String(priceValidUntil)}) has passed; search engines treat this as expired pricing`,
      regulatoryMapping: [],
    });
  }

  return findings;
}

function ruleProductRequired(
  blocks: SchemaBlock[],
  scanId: string,
): Finding[] {
  const findings: Finding[] = [];
  for (const block of blocks) {
    if (!block.valid || !isType(block, 'Product')) continue;

    const sel = jsonLdBlockSelector(block.blockIndex);

    for (const field of PRODUCT_REQUIRED_FIELDS) {
      if (!hasProperty(block, field)) {
        findings.push({
          id: `${RULE_PRODUCT_REQUIRED}-${block.blockIndex}-${field}`,
          scanId,
          domain: DOMAIN_ID,
          ruleId: RULE_PRODUCT_REQUIRED,
          severity: 'serious',
          element: { selector: sel },
          message: `Product schema is missing required property "${field}" needed for rich results`,
          regulatoryMapping: [],
        });
      }
    }

    const offer = extractOffer(block);
    if (!offer) {
      findings.push({
        id: `${RULE_PRODUCT_REQUIRED}-${block.blockIndex}-offers`,
        scanId,
        domain: DOMAIN_ID,
        ruleId: RULE_PRODUCT_REQUIRED,
        severity: 'serious',
        element: { selector: sel },
        message: 'Product schema is missing an "offers" property needed for rich results',
        regulatoryMapping: [],
      });
    } else {
      findings.push(...checkOffer(block, offer, scanId));
    }
  }
  return findings;
}

// ---------------------------------------------------------------------------
// Rule: sd-article-required
// ---------------------------------------------------------------------------

const ARTICLE_TYPES = new Set(['Article', 'BlogPosting', 'NewsArticle']);
const ARTICLE_REQUIRED_FIELDS = ['headline', 'datePublished', 'image'] as const;

function ruleArticleRequired(
  blocks: SchemaBlock[],
  scanId: string,
): Finding[] {
  const findings: Finding[] = [];
  for (const block of blocks) {
    if (!block.valid) continue;
    if (!block.types.some((t) => ARTICLE_TYPES.has(t.replace(/^https?:\/\/schema\.org\//, '')))) {
      continue;
    }

    const sel = jsonLdBlockSelector(block.blockIndex);

    for (const field of ARTICLE_REQUIRED_FIELDS) {
      if (!hasProperty(block, field)) {
        findings.push({
          id: `${RULE_ARTICLE_REQUIRED}-${block.blockIndex}-${field}`,
          scanId,
          domain: DOMAIN_ID,
          ruleId: RULE_ARTICLE_REQUIRED,
          severity: 'serious',
          element: { selector: sel },
          message: `Article schema is missing required property "${field}" needed for rich results`,
          regulatoryMapping: [],
        });
      }
    }

    // author.name is required for Articles.
    const author = prop(block, 'author');
    const authorName =
      author !== null && author !== undefined && typeof author === 'object' && !Array.isArray(author)
        ? (author as Record<string, unknown>)['name']
        : undefined;
    if (
      authorName === undefined ||
      authorName === null ||
      (typeof authorName === 'string' && authorName.trim().length === 0)
    ) {
      findings.push({
        id: `${RULE_ARTICLE_REQUIRED}-${block.blockIndex}-author-name`,
        scanId,
        domain: DOMAIN_ID,
        ruleId: RULE_ARTICLE_REQUIRED,
        severity: 'serious',
        element: { selector: sel },
        message: 'Article schema is missing required property "author.name" needed for rich results',
        regulatoryMapping: [],
      });
    }
  }
  return findings;
}

// ---------------------------------------------------------------------------
// DomainModule implementation
// ---------------------------------------------------------------------------

/**
 * Structured-data compliance domain. It detects JSON-LD (JavaScript Object
 * Notation for Linked Data — a machine-readable page annotation format) blocks
 * in captured HTML and checks them against requirements for Schema.org rich
 * results. It also participates in the cross-domain interaction pair with the
 * accessibility domain: an IMG element that lacks both an `alt` attribute and an
 * `ImageObject.description` in structured data is a single-fix opportunity where
 * one description supplies both fields.
 */
export const structuredDataDomain: DomainModule = {
  id: DOMAIN_ID,
  title: 'Structured Data / Schema.org',
  version: '0.1.0',

  extractors: {
    /**
     * During the shared element pass, record an element-scoped feature on every
     * IMG element. This places the structured-data domain's presence into
     * `byElement[selector].domainFeatures['structured-data']`, enabling the
     * cross-domain detector to join it with the accessibility domain's
     * `a11y:missing-alt` on the same selector — the element scope and shared
     * selector form the join key for the `accessibility|structured-data|element`
     * interaction pair.
     *
     * The `evaluate` method later determines whether a missing ImageObject
     * description finding is warranted, based on document-level JSON-LD data.
     */
    perElement(el: ElementHandle, acc: FeatureSink): void {
      if (el.nodeName.toLowerCase() === 'img') {
        acc.set(el.selector, SD_IMAGE_ANCHOR, true);
      }
    },

    /**
     * Parse all JSON-LD blocks from the captured HTML. Emit counts for the rule
     * engine: how many ImageObject entries lack a `description` property, and
     * the serialised block list for richer rule evaluation in `evaluate`.
     *
     * Extractors must be pure and synchronous: no network, no filesystem access.
     * All data comes from `snap.html` which is captured before the pass.
     */
    perDocument(snap: PropertySnapshot, acc: FeatureSink): void {
      const html = snap.html ?? '';
      const blocks = parseAllSchemaBlocks(html);

      // Store the parsed blocks for evaluate() to consume via byDocument.
      acc.set('', SD_SCHEMA_BLOCKS, JSON.stringify(blocks));

      // Count ImageObjects missing a description so evaluate() can produce
      // sd-image-object-description findings without re-parsing the HTML.
      let missingDescriptionCount = 0;
      for (const block of blocks) {
        if (block.valid && isType(block, 'ImageObject') && !hasProperty(block, 'description')) {
          missingDescriptionCount += 1;
        }
      }
      acc.set('', SD_IMAGE_OBJECT_MISSING_DESCRIPTION_COUNT, missingDescriptionCount);
    },
  },

  evaluate(features: ExtractedFeatures): Finding[] {
    // Retrieve the parsed blocks stored by perDocument.
    const rawBlocks = features.byDocument.get(SD_SCHEMA_BLOCKS);
    const blocks: SchemaBlock[] =
      typeof rawBlocks === 'string' && rawBlocks.length > 0
        ? (JSON.parse(rawBlocks) as SchemaBlock[])
        : [];

    const scanId = ''; // The orchestrator sets this field after evaluation.

    const findings: Finding[] = [
      ...ruleParseError(blocks, scanId),
      ...ruleImageObjectDescription(blocks, scanId),
      ...ruleProductRequired(blocks, scanId),
      ...ruleArticleRequired(blocks, scanId),
    ];

    return findings;
  },

  regulatory: [],

  /**
   * Declares participation in the `accessibility|structured-data|element` seed
   * interaction pair. The detector joins this feature with the accessibility
   * domain's `a11y:missing-alt` on the `element` scope (shared selector as join
   * value). When both features are present on the same element selector, the
   * detector can emit a synergy record: fixing one description field satisfies
   * both the alt-text requirement and the ImageObject.description requirement.
   */
  interactionFeatures: [
    {
      key: SD_IMAGE_ANCHOR,
      description:
        'IMG element is a potential schema image anchor — joins with accessibility missing-alt on the same element selector to surface a single-fix synergy',
      joinScope: 'element',
    } satisfies InteractionFeatureSpec,
  ],
};
