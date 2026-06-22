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

export interface AriadaDocusaurusOptions {
  reportFile?: string;
  failOn?: Severity | false;
}

export interface DocusaurusPostBuildArgs {
  outDir: string;
  routesPaths?: string[];
}

export interface DocusaurusPluginLike {
  name: string;
  postBuild(args: DocusaurusPostBuildArgs): Promise<void>;
}

export default function ariadaDocusaurusPlugin(
  _context: unknown,
  options: AriadaDocusaurusOptions = {},
): DocusaurusPluginLike {
  return {
    name: '@ariada-org/docusaurus-plugin',
    async postBuild(args) {
      await scanDocusaurusOutput(args.outDir, options);
    },
  };
}

export async function scanDocusaurusOutput(
  outDir: string,
  options: AriadaDocusaurusOptions = {},
): Promise<ViteScanReport> {
  const report = await scanViteOutput(outDir);
  const reportPath = resolve(outDir, options.reportFile ?? 'ariada-docusaurus-report.json');
  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  if (options.failOn !== false && hasFindingAtOrAbove(report, options.failOn ?? 'serious')) {
    throw new Error(`Ariada Docusaurus gate failed with ${report.summary.total} finding(s).`);
  }

  return report;
}

function hasFindingAtOrAbove(report: ViteScanReport, threshold: Severity): boolean {
  const rank: Record<Severity, number> = { minor: 1, moderate: 2, serious: 3, critical: 4 };
  return report.pages.some((page) =>
    page.findings.some((finding) => rank[finding.severity] >= rank[threshold]),
  );
}
