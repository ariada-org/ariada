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

export interface AriadaGatsbyOptions {
  publicDir?: string;
  reportFile?: string;
  failOn?: Severity | false;
}

export interface GatsbyPostBuildArgs {
  store?: {
    getState(): {
      program?: {
        directory?: string;
      };
    };
  };
  reporter?: {
    info(message: string): void;
  };
}

export async function onPostBuild(
  args: GatsbyPostBuildArgs = {},
  options: AriadaGatsbyOptions = {},
): Promise<void> {
  const root = args.store?.getState().program?.directory ?? process.cwd();
  const report = await scanGatsbyOutput(root, options);
  args.reporter?.info(`Ariada Gatsby scan found ${report.summary.total} issue(s).`);
}

export async function scanGatsbyOutput(
  projectRoot = process.cwd(),
  options: AriadaGatsbyOptions = {},
): Promise<ViteScanReport> {
  const outputDir = resolve(projectRoot, options.publicDir ?? 'public');
  const report = await scanViteOutput(outputDir);
  const reportPath = resolve(projectRoot, options.reportFile ?? 'ariada-gatsby-report.json');
  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  if (options.failOn !== false && hasFindingAtOrAbove(report, options.failOn ?? 'serious')) {
    throw new Error(`Ariada Gatsby gate failed with ${report.summary.total} finding(s).`);
  }

  return report;
}

function hasFindingAtOrAbove(report: ViteScanReport, threshold: Severity): boolean {
  const rank: Record<Severity, number> = { minor: 1, moderate: 2, serious: 3, critical: 4 };
  return report.pages.some((page) =>
    page.findings.some((finding) => rank[finding.severity] >= rank[threshold]),
  );
}
