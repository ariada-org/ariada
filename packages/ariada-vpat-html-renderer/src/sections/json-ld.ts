// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

// Embedded JSON-LD structured data (PRD §3.2.11).
//
// We use `@type: "TechArticle"` (schema.org core type) plus a custom
// `ariada:vpatReport` payload that carries the VPAT-specific shape. The
// dual representation keeps generic SEO crawlers happy while letting the
// Ariada-specific registry pick out the deeper data.

import type { ResolvedRenderOptions, VpatReport } from '../types.js';

/**
 *
 */
export function renderJsonLd(report: VpatReport, options: ResolvedRenderOptions): string {
  const payload = {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    name: report.meta.productName,
    dateCreated: report.meta.evaluationDate,
    inLanguage: options.locale,
    author: { '@type': 'Organization', name: report.meta.evaluator },
    'ariada:vpatReport': {
      '@type': 'VPATReport',
      schemaVersion: report.schemaVersion,
      productName: report.meta.productName,
      productVersion: report.meta.productVersion,
      evaluator: report.meta.evaluator,
      evaluationDate: report.meta.evaluationDate,
      scope: report.meta.scope,
      methodology: report.meta.methodology,
      applicableStandards: report.applicableStandards.map((s) => s.id),
      summary: report.summary,
      sourceJsonUrl: options.sourceJsonUrl,
    },
  };
  // The JSON.stringify output never contains `</script>` because Node's
  // serialiser escapes the path-tokens via standard JSON rules — but for
  // defense in depth we still escape the U+002F slash.
  const serialised = JSON.stringify(payload).replace(/<\/script/gi, '<\\/script');
  return `<script type="application/ld+json">${serialised}</script>`;
}
