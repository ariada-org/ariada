// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
/* eslint-disable jsdoc/require-jsdoc */

import type { AriadaFinding, StoryScanResult } from './scan.js';

export interface PanelViewModel {
  heading: string;
  status: 'waiting' | 'passed' | 'failed';
  summary: string;
  findings: AriadaFinding[];
}

export function createPanelViewModel(result: StoryScanResult | undefined): PanelViewModel {
  if (!result) {
    return {
      heading: 'Ariada accessibility',
      status: 'waiting',
      summary: 'Waiting for the story canvas scan.',
      findings: [],
    };
  }

  if (result.findings.length === 0) {
    return {
      heading: 'Ariada accessibility',
      status: 'passed',
      summary: `No findings for ${result.storyId}.`,
      findings: [],
    };
  }

  return {
    heading: 'Ariada accessibility',
    status: 'failed',
    summary: `${result.findings.length} finding${result.findings.length === 1 ? '' : 's'} for ${result.storyId}.`,
    findings: result.findings,
  };
}

export function renderPanelHtml(result: StoryScanResult | undefined): string {
  const model = createPanelViewModel(result);
  const items = model.findings
    .map(
      (finding) =>
        `<li><strong>${escapeHtml(finding.ruleId)}</strong> [${finding.severity}] ${escapeHtml(finding.message)} <code>${escapeHtml(finding.selector)}</code></li>`,
    )
    .join('');

  return `<section data-ariada-status="${model.status}"><h2>${model.heading}</h2><p>${escapeHtml(model.summary)}</p><ul>${items}</ul></section>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
