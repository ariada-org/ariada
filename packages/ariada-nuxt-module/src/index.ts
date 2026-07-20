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

export interface AriadaNuxtOptions {
  outputDir?: string;
  reportFile?: string;
  failOn?: Severity | false;
}

export interface NuxtLike {
  options: {
    rootDir: string;
  };
  hook(name: string, callback: () => Promise<void>): void;
}

export interface NuxtModuleLike {
  meta: {
    name: string;
    configKey: string;
  };
  setup(options: AriadaNuxtOptions, nuxt: NuxtLike): void;
}

export function ariadaNuxtModule(defaultOptions: AriadaNuxtOptions = {}): NuxtModuleLike {
  return {
    meta: {
      name: '@ariada-org/nuxt-module',
      configKey: 'ariada',
    },
    setup(options: AriadaNuxtOptions, nuxt: NuxtLike) {
      nuxt.hook('nitro:build:public-assets', async () => {
        await scanNuxtOutput(nuxt.options.rootDir, { ...defaultOptions, ...options });
      });
    },
  };
}

export default ariadaNuxtModule();

export async function scanNuxtOutput(
  projectRoot = process.cwd(),
  options: AriadaNuxtOptions = {},
): Promise<ViteScanReport> {
  const buildDir = await firstExistingDirectory(
    resolve(projectRoot, options.outputDir ?? '.output/public'),
    resolve(projectRoot, 'dist'),
  );
  const report = await scanViteOutput(buildDir);
  const reportPath = resolve(projectRoot, options.reportFile ?? 'ariada-nuxt-report.json');
  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  if (options.failOn !== false && hasFindingAtOrAbove(report, options.failOn ?? 'serious')) {
    throw new Error(`Ariada Nuxt gate failed with ${report.summary.total} finding(s).`);
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
      // Keep trying Nuxt output conventions.
    }
  }
  throw new Error(`No Nuxt HTML output found in: ${candidates.join(', ')}`);
}
