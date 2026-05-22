// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

// Functional Performance Criteria table.

import { escapeHtml } from '../escape.js';
import { FPC_MAPPING, deriveFpcStatus } from '../fpc-mapping.js';
import type { ResolvedRenderOptions, VpatConformanceStatus, VpatReport } from '../types.js';

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

const STATUS_CSS: Readonly<Record<VpatConformanceStatus, string>> = Object.freeze({
  supports: 'status-supports',
  'partially-supports': 'status-partial',
  'does-not-support': 'status-fail',
  'not-applicable': 'status-na',
  'not-evaluated': 'status-ne',
});

/**
 *
 */
export function renderFpc(report: VpatReport, options: ResolvedRenderOptions): string {
  const i18n = options.i18n;
  const rows = FPC_MAPPING.map((entry) => {
    const status = deriveFpcStatus(entry, report.criteria);
    return `<tr class="${STATUS_CSS[status]}">
  <th scope="row" id="${escapeHtml(entry.id)}">${escapeHtml(entry.nameKey)}</th>
  <td><span class="status-badge"><span class="status-label">${escapeHtml(statusLabel(status, options))}</span></span></td>
  <td>${
    entry.wcagScIds.length === 0
      ? ''
      : entry.wcagScIds
          .map((sc) => `<a href="#wcag-${escapeHtml(sc.replace(/\./g, '-'))}"><code>${escapeHtml(sc)}</code></a>`)
          .join(', ')
  }</td>
</tr>`;
  }).join('\n');

  return `<section id="fpc" aria-labelledby="fpc-heading">
<h2 id="fpc-heading">${escapeHtml(i18n.headings.fpc)}</h2>
<table class="vpat-table">
  <thead>
    <tr>
      <th scope="col">${escapeHtml(i18n.tableColumns.name)}</th>
      <th scope="col">${escapeHtml(i18n.tableColumns.status)}</th>
      <th scope="col">${escapeHtml(i18n.tableColumns.remarks)}</th>
    </tr>
  </thead>
  <tbody>${rows}</tbody>
</table>
</section>`;
}
