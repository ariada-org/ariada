// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
/**
 *
 */
export interface AriadaFindingSummary {
  readonly entityRef: string;
  readonly score: number;
  readonly status: 'pass' | 'warn' | 'fail';
  readonly critical: number;
  readonly serious: number;
  readonly moderate: number;
  readonly minor: number;
  readonly reportUrl?: string;
}

export const backstagePluginId = 'ariada';

/**
 *
 */
export function summarizeForCatalogCard(summary: AriadaFindingSummary): string {
  const total = summary.critical + summary.serious + summary.moderate + summary.minor;
  return `${summary.entityRef}: ${summary.status.toUpperCase()} score ${summary.score}; ${total} findings.`;
}

/**
 *
 */
export function renderFindingsCard(summary: AriadaFindingSummary): string {
  const reportLink = summary.reportUrl
    ? `<a href="${escapeHtml(summary.reportUrl)}">Open report</a>`
    : '<span>No report URL</span>';
  return [
    '<section data-plugin="ariada" aria-label="Ariada accessibility findings">',
    `<h2>Ariada accessibility</h2>`,
    `<p>${escapeHtml(summarizeForCatalogCard(summary))}</p>`,
    `<dl><dt>Critical</dt><dd>${summary.critical}</dd><dt>Serious</dt><dd>${summary.serious}</dd><dt>Moderate</dt><dd>${summary.moderate}</dd><dt>Minor</dt><dd>${summary.minor}</dd></dl>`,
    reportLink,
    '</section>',
  ].join('');
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
