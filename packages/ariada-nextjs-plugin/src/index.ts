// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
/* eslint-disable jsdoc/require-jsdoc */

import { access, mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import {
  scanViteOutput,
  type Severity,
  type ViteScanReport,
} from '@ariada-org/vite-plugin';

export interface AriadaNextOptions {
  outputDir?: string;
  reportFile?: string;
  failOn?: Severity | false;
}

export type NextWebpackHook = (config: unknown, context: unknown) => unknown;

export interface NextConfigLike {
  webpack?: NextWebpackHook;
  [key: string]: unknown;
}

export interface NextConfigWithAriada extends NextConfigLike {
  ariada: AriadaNextOptions;
}

export function withAriada<TConfig extends NextConfigLike>(
  nextConfig: TConfig = {} as TConfig,
  options: AriadaNextOptions = {},
): TConfig & NextConfigWithAriada {
  return {
    ...nextConfig,
    ariada: options,
    webpack(config: unknown, context: unknown) {
      return nextConfig.webpack ? nextConfig.webpack(config, context) : config;
    },
  };
}

export async function scanNextOutput(
  projectRoot = process.cwd(),
  options: AriadaNextOptions = {},
): Promise<ViteScanReport> {
  const buildDir = await firstExistingDirectory(
    resolve(projectRoot, options.outputDir ?? 'out'),
    resolve(projectRoot, '.next/server/app'),
    resolve(projectRoot, '.next/server/pages'),
  );
  const report = await scanViteOutput(buildDir);
  const reportPath = resolve(projectRoot, options.reportFile ?? 'ariada-nextjs-report.json');
  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  if (options.failOn !== false && hasFindingAtOrAbove(report, options.failOn ?? 'serious')) {
    throw new Error(`Ariada Next.js gate failed with ${report.summary.total} finding(s).`);
  }

  return report;
}

function hasFindingAtOrAbove(report: ViteScanReport, threshold: Severity): boolean {
  const rank: Record<Severity, number> = { minor: 1, moderate: 2, serious: 3, critical: 4 };
  return report.pages.some((page) =>
    page.findings.some((finding) => rank[finding.severity] >= rank[threshold]),
  );
}

async function firstExistingDirectory(...candidates: string[]): Promise<string> {
  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Keep trying Next.js output conventions.
    }
  }
  throw new Error(`No Next.js HTML output found in: ${candidates.join(', ')}`);
}
