// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

// WCAG 2.2 per-criterion conformance table (PRD §3.2.7).

import { escapeHtml } from '../escape.js';
import type {
  ResolvedRenderOptions,
  VpatConformanceStatus,
  VpatCriterion,
  VpatReport,
} from '../types.js';

/** Maps conformance status to its CSS class + non-colour symbol. */
const STATUS_PRESENTATION: Readonly<
  Record<VpatConformanceStatus, { readonly css: string; readonly symbol: string }>
> = Object.freeze({
  supports: { css: 'status-supports', symbol: '✓' },
  'partially-supports': { css: 'status-partial', symbol: '◐' },
  'does-not-support': { css: 'status-fail', symbol: '✗' },
  'not-applicable': { css: 'status-na', symbol: '—' },
  'not-evaluated': { css: 'status-ne', symbol: '?' },
});

function statusLabel(status: VpatConformanceStatus, opts: ResolvedRenderOptions): string {
  const dict = opts.i18n.status;
  switch (status) {
    case 'supports':
      return dict.supports;
    case 'partially-supports':
      return dict.partiallySupports;
    case 'does-not-support':
      return dict.doesNotSupport;
    case 'not-applicable':
      return dict.notApplicable;
    case 'not-evaluated':
      return dict.notEvaluated;
  }
}

function rowId(id: string): string {
  return `wcag-${id.replace(/\./g, '-')}`;
}

function renderRow(c: VpatCriterion, opts: ResolvedRenderOptions): string {
  const presentation = STATUS_PRESENTATION[c.status];
  const evidence = c.evidence && c.evidence.length > 0
    ? `<small class="evidence">Evidence: ${c.evidence.map(escapeHtml).join(', ')}</small>`
    : '';
  return `<tr id="${escapeHtml(rowId(c.id))}" class="${presentation.css}">
  <th scope="row"><code>${escapeHtml(c.id)}</code></th>
  <td>${escapeHtml(c.name)}</td>
  <td><span class="level level-${escapeHtml(c.level.toLowerCase())}">${escapeHtml(c.level)}</span></td>
  <td><span class="status-badge"><span aria-hidden="true" class="status-symbol">${presentation.symbol}</span><span class="status-label">${escapeHtml(statusLabel(c.status, opts))}</span></span></td>
  <td class="remarks">${escapeHtml(c.remarks ?? '')}${evidence}</td>
</tr>`;
}

/**
 * Render the WCAG 2.2 conformance table. AAA-level rows are wrapped in a
 * `<details>` toggle unless `options.includeAAA` is true.
 */
export function renderWcagTable(report: VpatReport, options: ResolvedRenderOptions): string {
  const i18n = options.i18n;
  const heading = `<h2 id="wcag-table-heading">${escapeHtml(i18n.headings.wcagTable)}</h2>`;

  if (report.criteria.length === 0) {
    return `<section id="wcag-table" aria-labelledby="wcag-table-heading">${heading}
<p role="alert" class="warning-banner">${escapeHtml(i18n.emptyCriteriaWarning)}</p>
</section>`;
  }

  const nonAAA = report.criteria.filter((c) => c.level !== 'AAA');
  const aaa = report.criteria.filter((c) => c.level === 'AAA');

  const tableHeader = `<thead>
  <tr>
    <th scope="col">${escapeHtml(i18n.tableColumns.criterion)}</th>
    <th scope="col">${escapeHtml(i18n.tableColumns.name)}</th>
    <th scope="col">${escapeHtml(i18n.tableColumns.level)}</th>
    <th scope="col">${escapeHtml(i18n.tableColumns.status)}</th>
    <th scope="col">${escapeHtml(i18n.tableColumns.remarks)}</th>
  </tr>
</thead>`;

  const mainBody = `<tbody>${nonAAA.map((c) => renderRow(c, options)).join('\n')}</tbody>`;

  const aaaSection = aaa.length === 0
    ? ''
    : options.includeAAA
      ? `<tbody class="aaa-rows">${aaa.map((c) => renderRow(c, options)).join('\n')}</tbody>`
      : `</table>
<details class="aaa-toggle">
  <summary>${escapeHtml(i18n.aaaToggle)}</summary>
  <table class="vpat-table vpat-table-aaa">
    ${tableHeader}
    <tbody>${aaa.map((c) => renderRow(c, options)).join('\n')}</tbody>
  </table>
</details>`;

  if (options.includeAAA) {
    return `<section id="wcag-table" aria-labelledby="wcag-table-heading">${heading}
<table class="vpat-table">
  ${tableHeader}
  ${mainBody}
  ${aaaSection}
</table>
</section>`;
  }

  return `<section id="wcag-table" aria-labelledby="wcag-table-heading">${heading}
<table class="vpat-table">
  ${tableHeader}
  ${mainBody}
${aaaSection}
</section>`;
}
