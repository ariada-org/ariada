// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Recovered from `dist/panel.js` and `dist/panel.d.ts`. Checked with
// `bash scripts/sverit-vosstanovlennoe.sh`.

import type { PlasmicScanResult } from './adapter.js';

/**
 * Render the panel shown inside the editor.
 *
 * The status line carries `role="status"`, so a screen reader announces the
 * result when it changes — which matters more here than anywhere, since the
 * panel reports on accessibility.
 *
 * @param result - the scan result
 * @returns a section of markup
 */
export function renderAriadaPanel(result: PlasmicScanResult): string {
  const rows = result.findings
    .map(
      (finding) =>
        `<li><strong>${escapeHtml(finding.ruleId)}</strong> <span>${escapeHtml(
          finding.severity,
        )}</span><p>${escapeHtml(finding.message)}</p></li>`,
    )
    .join('');
  return `<section data-plugin="ariada" aria-label="Ariada accessibility findings"><h2>Ariada scan</h2><p>${escapeHtml(
    result.projectName,
  )} / ${escapeHtml(result.pageName)}</p><p role="status">${
    result.totalFindings === 0 ? 'Passed' : `${result.totalFindings} finding(s)`
  } (${escapeHtml(result.target)} URL)</p><ol>${rows || '<li>No findings.</li>'}</ol></section>`;
}

/**
 * Escape a value for placing in markup as text.
 *
 * @param value - the text
 * @returns the escaped text
 */
function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
