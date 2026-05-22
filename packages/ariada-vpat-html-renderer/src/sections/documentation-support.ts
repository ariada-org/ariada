// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

// VPAT 2.5 INT Chapter 14 — Documentation and Support.

import { escapeHtml } from '../escape.js';
import type { ResolvedRenderOptions, VpatReport } from '../types.js';

/**
 *
 */
export function renderDocumentationSupport(
  report: VpatReport,
  options: ResolvedRenderOptions,
): string {
  const i18n = options.i18n;
  const brand = options.brand;
  const contactEmail =
    brand.contactEmail ?? report.meta.evaluatorContact ?? '';
  const contactUrl = brand.contactUrl ?? '';
  const contactCell = contactEmail || contactUrl
    ? [
        contactEmail
          ? `<a href="mailto:${escapeHtml(contactEmail)}">${escapeHtml(contactEmail)}</a>`
          : '',
        contactUrl
          ? `<a href="${escapeHtml(contactUrl)}" rel="noopener noreferrer">${escapeHtml(contactUrl)}</a>`
          : '',
      ]
        .filter(Boolean)
        .join(' · ')
    : escapeHtml(i18n.meta.contactNotProvided);

  return `<section id="documentation" aria-labelledby="documentation-heading">
<h2 id="documentation-heading">${escapeHtml(i18n.headings.documentation)}</h2>
<table class="vpat-table">
  <thead>
    <tr>
      <th scope="col">${escapeHtml(i18n.tableColumns.criterion)}</th>
      <th scope="col">${escapeHtml(i18n.tableColumns.status)}</th>
      <th scope="col">${escapeHtml(i18n.tableColumns.remarks)}</th>
    </tr>
  </thead>
  <tbody>
    <tr class="status-supports">
      <th scope="row"><code>14.1</code> Support Documentation</th>
      <td>${escapeHtml(i18n.status.supports)}</td>
      <td>${escapeHtml(report.meta.methodology)}</td>
    </tr>
    <tr class="status-supports">
      <th scope="row"><code>14.2</code> Personnel Support</th>
      <td>${escapeHtml(i18n.status.supports)}</td>
      <td>${contactCell}</td>
    </tr>
  </tbody>
</table>
</section>`;
}
