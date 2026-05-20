// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

// Conformance summary chapter (PRD §3.2.6).

import { escapeHtml } from '../escape.js';
import type { ResolvedRenderOptions, VpatReport, VpatSummary } from '../types.js';

/** Format the summary narrative sentence with localised template. */
export function formatNarrative(summary: VpatSummary, template: string): string {
  return template
    .replace('{total}', String(summary.total))
    .replace('{supports}', String(summary.supports))
    .replace('{partial}', String(summary.partiallySupports))
    .replace('{doesNot}', String(summary.doesNotSupport))
    .replace('{notApplicable}', String(summary.notApplicable))
    .replace('{notEvaluated}', String(summary.notEvaluated));
}

/**
 *
 */
export function renderSummary(report: VpatReport, options: ResolvedRenderOptions): string {
  const i18n = options.i18n;
  const narrative = formatNarrative(report.summary, i18n.summaryNarrative);
  return `<section id="summary" aria-labelledby="summary-heading">
<h2 id="summary-heading">${escapeHtml(i18n.headings.summary)}</h2>
<p class="summary-narrative">${escapeHtml(narrative)}</p>
<dl class="summary-counts">
  <dt>${escapeHtml(i18n.status.supports)}</dt>
  <dd class="status-supports"><strong>${report.summary.supports}</strong></dd>
  <dt>${escapeHtml(i18n.status.partiallySupports)}</dt>
  <dd class="status-partial"><strong>${report.summary.partiallySupports}</strong></dd>
  <dt>${escapeHtml(i18n.status.doesNotSupport)}</dt>
  <dd class="status-fail"><strong>${report.summary.doesNotSupport}</strong></dd>
  <dt>${escapeHtml(i18n.status.notApplicable)}</dt>
  <dd class="status-na"><strong>${report.summary.notApplicable}</strong></dd>
  <dt>${escapeHtml(i18n.status.notEvaluated)}</dt>
  <dd class="status-ne"><strong>${report.summary.notEvaluated}</strong></dd>
</dl>
</section>`;
}
