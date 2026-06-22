// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
/* eslint-disable jsdoc/require-jsdoc */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import {
  scanViteOutput,
  type Severity,
  type ViteScanReport,
} from '@ariada-org/vite-plugin';

export interface AriadaEleventyOptions {
  outputDir?: string;
  reportFile?: string;
  failOn?: Severity | false;
}

export interface EleventyAfterEvent {
  dir?: {
    output?: string;
  };
}

export interface EleventyConfigLike {
  on(name: 'eleventy.after', callback: (event: EleventyAfterEvent) => Promise<void>): void;
}

export default function ariadaEleventy(
  eleventyConfig: EleventyConfigLike,
  options: AriadaEleventyOptions = {},
): void {
  eleventyConfig.on('eleventy.after', async (event) => {
    await scanEleventyOutput(process.cwd(), {
      ...options,
      outputDir: options.outputDir ?? event.dir?.output ?? '_site',
    });
  });
}

export async function scanEleventyOutput(
  projectRoot = process.cwd(),
  options: AriadaEleventyOptions = {},
): Promise<ViteScanReport> {
  const outputDir = resolve(projectRoot, options.outputDir ?? '_site');
  const report = await scanViteOutput(outputDir);
  const reportPath = resolve(projectRoot, options.reportFile ?? 'ariada-eleventy-report.json');
  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  if (options.failOn !== false && hasFindingAtOrAbove(report, options.failOn ?? 'serious')) {
    throw new Error(`Ariada Eleventy gate failed with ${report.summary.total} finding(s).`);
  }

  return report;
}

function hasFindingAtOrAbove(report: ViteScanReport, threshold: Severity): boolean {
  const rank: Record<Severity, number> = { minor: 1, moderate: 2, serious: 3, critical: 4 };
  return report.pages.some((page) =>
    page.findings.some((finding) => rank[finding.severity] >= rank[threshold]),
  );
}
