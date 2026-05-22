// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

// Cover page section.

import { escapeHtml } from '../escape.js';
import { sanitiseSvg } from '../sanitise-svg.js';
import type { ResolvedRenderOptions, VpatReport } from '../types.js';

function parseEvaluationDate(iso: string): Date {
  // ISO 8601 calendar date — accept YYYY-MM-DD strict; reject anything else.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    throw new Error(`Invalid evaluationDate (expected YYYY-MM-DD): ${iso}`);
  }
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`Invalid evaluationDate: ${iso}`);
  }
  return d;
}

function isStale(iso: string, freshnessWarningDays: number, nowIso: string): boolean {
  const d = parseEvaluationDate(iso);
  const now = new Date(nowIso);
  if (Number.isNaN(now.getTime())) {
    return false;
  }
  const ageMs = now.getTime() - d.getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  return ageDays > freshnessWarningDays;
}

/**
 *
 */
export function renderCover(report: VpatReport, options: ResolvedRenderOptions): string {
  const i18n = options.i18n;
  const meta = report.meta;
  const brand = options.brand;

  // Validate the date eagerly so the renderer fails fast on malformed input
  // ("Invalid evaluationDate ... do not silently render broken").
  parseEvaluationDate(meta.evaluationDate);

  const vendorName = brand.vendorName ?? meta.productName;
  const logo = brand.logoSvg ? sanitiseSvg(brand.logoSvg) : '';

  const contactLine = meta.evaluatorContact
    ? `${escapeHtml(i18n.meta.contact)}: ${escapeHtml(meta.evaluatorContact)}`
    : `<strong class="contact-missing">${escapeHtml(i18n.meta.contactNotProvided)}</strong>`;

  const stale = isStale(meta.evaluationDate, options.freshnessWarningDays, options.generationTimestamp);
  const freshnessBanner = stale
    ? `<p role="alert" class="freshness-banner">${escapeHtml(i18n.freshnessWarning)}</p>`
    : '';

  const summary = report.summary;
  const statsBar = renderSummaryBar(summary);

  return `<section id="cover" aria-labelledby="cover-heading">
${logo ? `<div class="brand-logo" aria-hidden="true">${logo}</div>` : ''}
<h1 id="cover-heading">${escapeHtml(i18n.title)}</h1>
<p class="vendor-banner"><strong>${escapeHtml(vendorName)}</strong></p>
${freshnessBanner}
<dl class="meta-grid">
  <dt>${escapeHtml(i18n.meta.product)}</dt>
  <dd>${escapeHtml(meta.productName)}${meta.productVersion ? ` <span class="meta-version">v${escapeHtml(meta.productVersion)}</span>` : ''}</dd>
  <dt>${escapeHtml(i18n.meta.evaluator)}</dt>
  <dd>${escapeHtml(meta.evaluator)}</dd>
  <dt>${escapeHtml(i18n.meta.contact)}</dt>
  <dd>${contactLine}</dd>
  <dt>${escapeHtml(i18n.meta.evaluationDate)}</dt>
  <dd><time datetime="${escapeHtml(meta.evaluationDate)}">${escapeHtml(meta.evaluationDate)}</time></dd>
  <dt>${escapeHtml(i18n.meta.scope)}</dt>
  <dd>${escapeHtml(meta.scope)}</dd>
  <dt>${escapeHtml(i18n.meta.methodology)}</dt>
  <dd>${escapeHtml(meta.methodology)}</dd>
</dl>
<div class="summary-stats" aria-label="${escapeHtml(i18n.headings.summary)}">
${statsBar}
</div>
</section>`;
}

function renderSummaryBar(summary: VpatReport['summary']): string {
  const total = summary.total === 0 ? 1 : summary.total;
  const segments: ReadonlyArray<{
    readonly key: string;
    readonly count: number;
    readonly cssClass: string;
    readonly symbol: string;
  }> = [
    { key: 'Supports', count: summary.supports, cssClass: 'status-supports', symbol: '✓' },
    {
      key: 'Partially',
      count: summary.partiallySupports,
      cssClass: 'status-partial',
      symbol: '◐',
    },
    {
      key: 'Does Not Support',
      count: summary.doesNotSupport,
      cssClass: 'status-fail',
      symbol: '✗',
    },
    { key: 'Not Applicable', count: summary.notApplicable, cssClass: 'status-na', symbol: '—' },
    { key: 'Not Evaluated', count: summary.notEvaluated, cssClass: 'status-ne', symbol: '?' },
  ];
  return segments
    .map((s) => {
      const pct = ((s.count / total) * 100).toFixed(1);
      return `<div class="summary-cell ${s.cssClass}"><span class="summary-symbol" aria-hidden="true">${s.symbol}</span><span class="summary-count">${s.count}</span><span class="summary-key">${escapeHtml(s.key)}</span><span class="summary-pct">${pct}%</span></div>`;
    })
    .join('');
}
