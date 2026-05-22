// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

// VPAT 2.5 INT Chapters 4-7 (hardware + closed-functionality software).
// For web/SaaS products these are uniformly «Not Applicable».

import { escapeHtml } from '../escape.js';
import type { ResolvedRenderOptions } from '../types.js';

/**
 *
 */
export function renderChapters4To7(options: ResolvedRenderOptions): string {
  const i18n = options.i18n;
  const justification = escapeHtml(i18n.notApplicableJustification);
  const naLabel = escapeHtml(i18n.status.notApplicable);
  const rowsHardware = `<tr class="status-na">
  <th scope="row">${escapeHtml(i18n.headings.hardware)}</th>
  <td>${naLabel}</td>
  <td>${justification}</td>
</tr>`;
  const rowsSoftware = `<tr class="status-na">
  <th scope="row">${escapeHtml(i18n.headings.software)}</th>
  <td>${naLabel}</td>
  <td>${justification}</td>
</tr>`;
  return `<section id="chapters-4-to-7" aria-labelledby="chapters-4-to-7-heading">
<h2 id="chapters-4-to-7-heading">${escapeHtml(i18n.headings.hardware)} / ${escapeHtml(i18n.headings.software)}</h2>
<table class="vpat-table">
  <thead>
    <tr>
      <th scope="col">${escapeHtml(i18n.tableColumns.criterion)}</th>
      <th scope="col">${escapeHtml(i18n.tableColumns.status)}</th>
      <th scope="col">${escapeHtml(i18n.tableColumns.remarks)}</th>
    </tr>
  </thead>
  <tbody>
${rowsHardware}
${rowsSoftware}
  </tbody>
</table>
</section>`;
}
