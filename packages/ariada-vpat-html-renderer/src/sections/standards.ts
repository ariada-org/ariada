// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

// Applicable Standards chapter (PRD §3.2.4).

import { escapeHtml } from '../escape.js';
import type { ResolvedRenderOptions, VpatReport } from '../types.js';

/**
 *
 */
export function renderStandards(report: VpatReport, options: ResolvedRenderOptions): string {
  const i18n = options.i18n;
  const rows = report.applicableStandards.map((std) => {
    const title = `<strong>${escapeHtml(std.id)}</strong> — ${escapeHtml(std.title)}`;
    const linked = std.url
      ? `<a href="${escapeHtml(std.url)}" rel="noopener noreferrer" aria-label="${escapeHtml(std.title)} (external)">${title}</a>`
      : title;
    return `<li>${linked}</li>`;
  }).join('\n');
  return `<section id="standards" aria-labelledby="standards-heading">
<h2 id="standards-heading">${escapeHtml(i18n.headings.standards)}</h2>
<ul class="standards-list">
${rows}
</ul>
</section>`;
}
