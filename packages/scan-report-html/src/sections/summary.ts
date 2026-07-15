// SPDX-License-Identifier: EUPL-1.2
// SPDX-FileCopyrightText: 2026 Agonist Development AB
/**
 * Summary section — compliance score gauge + severity breakdown bars.
 *
 * Score is a heuristic — label clearly. Bars use
 * `aria-valuenow` so screen readers announce the count, not the colour.
 */

import { escapeHtml } from '../escape.js';
import {
  bandFromScore,
  computeComplianceScore,
  severityBreakdown,
} from '../score.js';
import type { ScanFinding, Severity } from '../types.js';

const SEVERITY_LABEL: Readonly<Record<Severity, string>> = {
  critical: 'Critical',
  serious: 'Serious',
  moderate: 'Moderate',
  minor: 'Minor',
};

/**
 * Render the compliance summary dashboard. Always shown.
 */
export function renderSummary(findings: readonly ScanFinding[]): string {
  const score = computeComplianceScore(findings);
  const band = bandFromScore(score);
  const breakdown = severityBreakdown(findings);
  const total = findings.length;

  const bars = (['critical', 'serious', 'moderate', 'minor'] as const)
    .map((severity) => renderSeverityBar(severity, breakdown[severity], total))
    .join('\n      ');

  return `<section class="summary" aria-labelledby="summary-heading">
  <h2 id="summary-heading">Summary</h2>
  <div class="summary__grid">
    <div class="summary__score" role="group" aria-labelledby="score-label">
      <p id="score-label" class="summary__score-label">Compliance score (heuristic)</p>
      <p class="summary__score-value summary__score-value--${band}" aria-live="polite">
        <span class="summary__score-number">${score}</span><span class="summary__score-unit">/100</span>
      </p>
      <p class="summary__score-band">${escapeHtml(formatBand(band))}</p>
      <p class="summary__score-caveat">Heuristic compliance indicator — see the canonical signed-score module for the authoritative figure.</p>
    </div>
    <div class="summary__breakdown" role="group" aria-labelledby="breakdown-label">
      <p id="breakdown-label" class="summary__breakdown-label">Severity breakdown (${total} ${total === 1 ? 'finding' : 'findings'})</p>
      ${bars}
    </div>
  </div>
</section>`;
}

function renderSeverityBar(severity: Severity, count: number, total: number): string {
  const widthPercent = total === 0 ? 0 : Math.round((count / total) * 100);
  return `<div class="bar bar--${severity}">
        <span class="bar__label">${escapeHtml(SEVERITY_LABEL[severity])}</span>
        <div class="bar__track" role="progressbar" aria-valuenow="${count}" aria-valuemin="0" aria-valuemax="${total}" aria-label="${escapeHtml(SEVERITY_LABEL[severity])}: ${count} of ${total}">
          <div class="bar__fill bar__fill--${severity}" style="width: ${widthPercent}%"></div>
        </div>
        <span class="bar__count">${count}</span>
      </div>`;
}

function formatBand(band: 'compliant' | 'work-in-progress' | 'non-compliant'): string {
  switch (band) {
    case 'compliant':
      return 'Compliant';
    case 'work-in-progress':
      return 'Work in progress';
    case 'non-compliant':
      return 'Non-compliant';
  }
}
