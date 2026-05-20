// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

// Top-level orchestrator. Pure function — given the same inputs it always
// returns the same string. The only non-determinism source is
// `generationTimestamp`; callers seeking byte-identical output between
// calls should pass an explicit value.

import { escapeHtml } from './escape.js';
import { isRtlLocale, resolveLocale } from './locales.js';
import { sanitiseColor, sanitiseSvg } from './sanitise-svg.js';
import { renderChapters4To7 } from './sections/chapters-4-to-7.js';
import { renderCover } from './sections/cover.js';
import { renderDocumentationSupport } from './sections/documentation-support.js';
import { renderFooter } from './sections/footer.js';
import { renderFpc } from './sections/fpc.js';
import { renderJsonLd } from './sections/json-ld.js';
import { renderStandards } from './sections/standards.js';
import { renderSummary } from './sections/summary.js';
import { renderToc } from './sections/toc.js';
import { renderWcagTable } from './sections/wcag-table.js';
import { renderStyles } from './styles/base.js';
import type {
 BrandOptions,
 RenderOptions,
 ResolvedRenderOptions,
 VpatReport,
} from './types.js';

const SUPPORTED_SCHEMA_VERSION = '2.5';
const PACKAGE_VERSION = '0.1.0';

function noop(): void {
 /* no-op */
}

function resolveOptions(options: RenderOptions): ResolvedRenderOptions {
 const requestedLocale = options.locale;
 const { locale, i18n, fallback } = resolveLocale(requestedLocale);
 const onWarn = options.onWarn ?? noop;
 if (fallback !== undefined) {
 onWarn(`locale fallback: requested "${fallback}" → using "${locale}"`);
 }
 const brand: BrandOptions = options.brand ?? {};
 const sanitisedColour =
 brand.primaryColor !== undefined ? sanitiseColor(brand.primaryColor) : undefined;
 const sanitisedBrand: BrandOptions = {
 ...(brand.vendorName !== undefined ? { vendorName: brand.vendorName } : {}),
 ...(brand.logoSvg !== undefined ? { logoSvg: sanitiseSvg(brand.logoSvg) } : {}),
 ...(sanitisedColour !== undefined ? { primaryColor: sanitisedColour } : {}),
 ...(brand.contactEmail !== undefined ? { contactEmail: brand.contactEmail } : {}),
 ...(brand.contactUrl !== undefined ? { contactUrl: brand.contactUrl } : {}),
 };
 return {
 locale,
 brand: sanitisedBrand,
 includeAAA: options.includeAAA ?? false,
 freshnessWarningDays: options.freshnessWarningDays ?? 365,
 generationTimestamp: options.generationTimestamp ?? new Date().toISOString(),
 sourceJsonUrl: options.sourceJsonUrl,
 onWarn,
 i18n,
 };
}

/**
 * Render a VPAT 2.5 INT JSON report to a single self-contained HTML5
 * document. Pure function: no I/O, no logging, no telemetry.
 *
 * Throws:
 * - TypeError if `report` is undefined / null
 * - Error if `report.schemaVersion !== '2.5'`
 * - Error if `report.meta.evaluationDate` is not YYYY-MM-DD
 */
export function renderVpatHtml(report: VpatReport, options: RenderOptions = {}): string {
 if (report === undefined || report === null) {
 throw new TypeError('renderVpatHtml: report is required');
 }
 if (report.schemaVersion !== SUPPORTED_SCHEMA_VERSION) {
 throw new Error(
 `Unsupported VPAT schema version: ${String(report.schemaVersion)}. Expected ${SUPPORTED_SCHEMA_VERSION}.`,
);
 }

 const resolved = resolveOptions(options);
 const i18n = resolved.i18n;
 const title = `${escapeHtml(i18n.title)} — ${escapeHtml(report.meta.productName)}${
 report.meta.productVersion ? ` ${escapeHtml(report.meta.productVersion)}` : ''
 } — ${escapeHtml(report.meta.evaluationDate)}`;

 const styles = renderStyles(resolved);
 const cover = renderCover(report, resolved);
 const standards = renderStandards(report, resolved);
 const toc = renderToc(resolved);
 const summary = renderSummary(report, resolved);
 const wcagTable = renderWcagTable(report, resolved);
 const fpc = renderFpc(report, resolved);
 const chapters4to7 = renderChapters4To7(resolved);
 const docSupport = renderDocumentationSupport(report, resolved);
 const jsonLd = renderJsonLd(report, resolved);
 const footer = renderFooter(PACKAGE_VERSION, resolved);

 const localeFallbackMeta =
 options.locale !== undefined && options.locale.toLowerCase() !== resolved.locale
 ? `<meta name="ariada-locale-fallback" content="${escapeHtml(options.locale)}→${escapeHtml(resolved.locale)}">`
 : '';

 // Direction is RTL when EITHER the requested locale OR the resolved locale
 // is an RTL script. This lets callers pass `locale: 'he'` (no Hebrew
 // dictionary shipped yet) and still render correctly direction-wise — the
 // strings fall back to English but the layout flips. Per testing-strategy
 // a v0.2 addendum.
 const requestedLocale = options.locale;
 const directionLocale = requestedLocale ?? resolved.locale;
 const dir = isRtlLocale(directionLocale) || isRtlLocale(resolved.locale) ? 'rtl' : 'ltr';

 return `<!DOCTYPE html>
<html lang="${escapeHtml(resolved.locale)}" dir="${dir}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<meta name="description" content="${title}">
<meta name="generator" content="@ariada/vpat-html-renderer/${PACKAGE_VERSION}">
${localeFallbackMeta}
${styles}
</head>
<body>
<a href="#main" class="skip-link">${escapeHtml(i18n.skipLink)}</a>
<header role="banner">
${toc}
</header>
<main id="main" role="main">
${cover}
${standards}
${summary}
${wcagTable}
${fpc}
${chapters4to7}
${docSupport}
</main>
${footer}
${jsonLd}
</body>
</html>`;
}
