// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
/* eslint-disable jsdoc/require-jsdoc */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import type { BuildScanReport } from './scan.js';

export async function writeJsonReport(report: BuildScanReport, outputFile: string): Promise<void> {
  await mkdir(dirname(outputFile), { recursive: true });
  await writeFile(outputFile, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

export function renderTextReport(report: BuildScanReport): string {
  const lines = [
    `Ariada Astro build report`,
    `Generated: ${report.generatedAt}`,
    `Total findings: ${report.summary.total}`,
    `Critical: ${report.summary.critical}`,
    `Serious: ${report.summary.serious}`,
    `Moderate: ${report.summary.moderate}`,
    `Minor: ${report.summary.minor}`,
  ];

  for (const page of report.pages) {
    if (page.findings.length === 0) continue;
    lines.push('', page.filePath);
    for (const finding of page.findings) {
      lines.push(`  ${finding.ruleId} [${finding.severity}] ${finding.selector}: ${finding.message}`);
    }
  }

  return `${lines.join('\n')}\n`;
}
