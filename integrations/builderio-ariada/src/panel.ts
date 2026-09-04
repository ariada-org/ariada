// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Recovered from `dist/panel.js` and `dist/panel.d.ts`. Checked with
// `bash scripts/sverit-vosstanovlennoe.sh`.

import type { AriadaPanelResult } from './scan.js';

/**
 * Escape a value for placing in markup as text.
 *
 * Every field of a finding goes through this. A rule identifier or a message
 * comes out of a scan of somebody else's page, and a page can name its own
 * elements whatever it likes.
 *
 * @param value - the text
 * @returns the escaped text
 */
function escape(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

/**
 * Render the panel shown inside the editor.
 *
 * @param result - the scan result
 * @returns a section of markup
 */
export function renderFindingsPanel(result: AriadaPanelResult): string {
  const status = result.passed ? 'PASS' : 'FAIL';
  const findings = result.findings
    .map(
      (finding) =>
        `<li><strong>${escape(finding.impact)}</strong> ${escape(
          finding.message,
        )} <code>${escape(finding.id)}</code></li>`,
    )
    .join('');
  return `<section data-ariada-panel aria-label="Ariada accessibility results"><h2>Ariada: ${status}</h2><p>${
    result.total
  } finding${result.total === 1 ? '' : 's'} for <a href="${escape(
    result.target.url,
  )}">${escape(result.target.url)}</a></p><ul>${
    findings || '<li>No findings</li>'
  }</ul></section>`;
}
