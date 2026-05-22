// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

// VPAT 2.5 INT input contract.
//
// Mirrors the ITI VPAT 2.5 INT (Information Technology Industry Council —
// Voluntary Product Accessibility Template, International variant) shape as
// produced by the @ariada-org/evidence-emitter package. The renderer treats
// `VpatReport` as a closed schema pinned to `schemaVersion: "2.5"`.
//
// This file defines the schema locally rather than depending on the
// evidence-emitter package at runtime — the renderer is a pure transform
// over JSON data and must not pull in the emitter's scanning runtime. Once
// @ariada-org/evidence-emitter ships, the types here remain structurally
// compatible (and can be `Extract`-ed into a shared `@ariada-org/vpat-schema`
// package if that is ever justified).

/** WCAG (Web Content Accessibility Guidelines) conformance level. */
export type VpatConformanceLevel = 'A' | 'AA' | 'AAA';

/**
 * Per-criterion conformance status. Values match the canonical VPAT 2.5 INT
 * vocabulary; serialised in lowercase-hyphenated form for JSON-friendliness.
 */
export type VpatConformanceStatus =
 | 'supports'
 | 'partially-supports'
 | 'does-not-support'
 | 'not-applicable'
 | 'not-evaluated';

/**
 * VPAT-applicable standard reference (Section 508, EN 301 549, WCAG, etc.).
 * The renderer lists these in the «Applicable Standards» chapter and may
 * link `url` to the authoritative source.
 */
export interface VpatApplicableStandard {
 /** Short identifier, e.g. "WCAG 2.2", "EN 301 549 v3.2.1", "Section 508". */
 readonly id: string;
 /** Human-readable title. */
 readonly title: string;
 /** Optional URL to the authoritative source (W3C, ETSI, GSA, etc.). */
 readonly url?: string;
}

/**
 * Per-Success-Criterion evaluation row. Renders as one row in the WCAG 2.2
 * conformance table.
 */
export interface VpatCriterion {
 /** Dotted Success-Criterion identifier, e.g. "1.1.1", "2.4.7". */
 readonly id: string;
 /** Criterion name, e.g. "Non-text Content". */
 readonly name: string;
 /** WCAG conformance level. */
 readonly level: VpatConformanceLevel;
 /** Conformance status assigned by the evaluator. */
 readonly status: VpatConformanceStatus;
 /** Free-form remarks. May contain multiple paragraphs; rendered escaped. */
 readonly remarks?: string;
 /**
 * Optional evidence reference IDs (e.g. evidence-bundle filenames or scan
 * event IDs) the evaluator cited when assigning the status. Rendered as
 * a comma-separated `<small>` line under the remarks cell.
 */
 readonly evidence?: ReadonlyArray<string>;
}

/**
 * Aggregate counts derived from `criteria[]`. The renderer treats this as
 * authoritative for the summary chapter (and cross-checks against an
 * independent recount in the deterministic-summary test).
 */
export interface VpatSummary {
 readonly total: number;
 readonly supports: number;
 readonly partiallySupports: number;
 readonly doesNotSupport: number;
 readonly notApplicable: number;
 readonly notEvaluated: number;
}

/** Cover-page metadata. */
export interface VpatMeta {
 readonly productName: string;
 readonly productVersion?: string;
 /** Evaluator legal name (organisation or individual). */
 readonly evaluator: string;
 /**
 * Free-form contact (email, URL, or postal address). The renderer escapes
 * but does not validate; missing values trigger a «Contact: not provided»
 * banner.
 */
 readonly evaluatorContact?: string;
 /** ISO 8601 calendar date (YYYY-MM-DD) of the evaluation. */
 readonly evaluationDate: string;
 /** Free-form scope description. */
 readonly scope: string;
 /** Free-form methodology description. */
 readonly methodology: string;
}

/**
 * Canonical VPAT 2.5 INT report shape consumed by the renderer.
 *
 * `schemaVersion` MUST equal `"2.5"`. Any other value throws — see
 * `renderVpatHtml` error handling.
 */
export interface VpatReport {
 readonly schemaVersion: '2.5';
 readonly meta: VpatMeta;
 readonly applicableStandards: ReadonlyArray<VpatApplicableStandard>;
 readonly criteria: ReadonlyArray<VpatCriterion>;
 readonly summary: VpatSummary;
}

// -----------------------------------------------------------------------------
// Render options
// -----------------------------------------------------------------------------

/**
 * Vendor brand customisation. All fields optional; defaults render a neutral
 * Ariada-themed cover banner. `logoSvg` is sanitised against
 * scripts / event handlers / `javascript:` URLs.
 */
export interface BrandOptions {
 readonly vendorName?: string;
 /**
 * Inline SVG string (Scalable Vector Graphics). The renderer strips
 * `<script>`, `on*=` attributes, and `javascript:` URLs before embedding.
 */
 readonly logoSvg?: string;
 /**
 * CSS colour value. Must be a literal colour (`#0b3d91`, `rgb(...)`,
 * `hsl(...)`, or a CSS named colour). Strings containing `;`, `{`, `}`,
 * `<`, `>`, or `url(` are rejected as unsafe.
 */
 readonly primaryColor?: string;
 readonly contactEmail?: string;
 readonly contactUrl?: string;
}

/** Renderer options. All fields optional; sane defaults apply. */
export interface RenderOptions {
 /**
 * BCP 47 locale code (Best Current Practice 47, language-tag syntax).
 * MVP-supported: `en`, `sv`, `de`. Unknown locales fall back to `en` and
 * emit a `<meta name="ariada-locale-fallback">` tag for telemetry.
 */
 readonly locale?: string;
 /** Vendor brand overrides. */
 readonly brand?: BrandOptions;
 /** Include AAA-level rows even when "Not Evaluated". Default `false`. */
 readonly includeAAA?: boolean;
 /** Days after which `evaluationDate` triggers a freshness banner. Default 365. */
 readonly freshnessWarningDays?: number;
 /**
 * Fixed generation timestamp (ISO 8601). When provided, the renderer is
 * deterministic — identical inputs produce byte-identical outputs.
 * Default: `new Date().toISOString()` evaluated once per call.
 */
 readonly generationTimestamp?: string;
 /** Optional source-JSON URL embedded in JSON-LD + footer. */
 readonly sourceJsonUrl?: string;
 /** Soft-warning hook for locale fallbacks, AAA mismatch, etc. */
 readonly onWarn?: (msg: string) => void;
}

/**
 * Internal resolved-options shape — RenderOptions with defaults applied.
 * Used by section renderers to avoid re-resolving defaults per section.
 */
export interface ResolvedRenderOptions {
 readonly locale: string;
 readonly brand: BrandOptions;
 readonly includeAAA: boolean;
 readonly freshnessWarningDays: number;
 readonly generationTimestamp: string;
 readonly sourceJsonUrl: string | undefined;
 readonly onWarn: (msg: string) => void;
 /** Resolved locale dictionary (loaded from src/locales/<locale>.json). */
 readonly i18n: LocaleDictionary;
}

/** Locale-translated UI strings. Keys mirror src/locales/en.json. */
export interface LocaleDictionary {
 readonly skipLink: string;
 readonly title: string;
 readonly headings: {
 readonly cover: string;
 readonly standards: string;
 readonly toc: string;
 readonly summary: string;
 readonly wcagTable: string;
 readonly fpc: string;
 readonly hardware: string;
 readonly software: string;
 readonly documentation: string;
 readonly footer: string;
 };
 readonly tableColumns: {
 readonly criterion: string;
 readonly name: string;
 readonly level: string;
 readonly status: string;
 readonly remarks: string;
 };
 readonly status: {
 readonly supports: string;
 readonly partiallySupports: string;
 readonly doesNotSupport: string;
 readonly notApplicable: string;
 readonly notEvaluated: string;
 };
 readonly meta: {
 readonly product: string;
 readonly version: string;
 readonly evaluator: string;
 readonly contact: string;
 readonly evaluationDate: string;
 readonly scope: string;
 readonly methodology: string;
 readonly contactNotProvided: string;
 };
 readonly freshnessWarning: string;
 readonly notApplicableJustification: string;
 readonly aaaToggle: string;
 readonly emptyCriteriaWarning: string;
 readonly generatedBy: string;
 readonly maintainedBy: string;
 readonly licenceNotice: string;
 readonly summaryNarrative: string;
}
