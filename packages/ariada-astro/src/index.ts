// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
/* eslint-disable jsdoc/require-jsdoc */

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { renderTextReport, writeJsonReport } from './report.js';
import {
  buildReport,
  defaultHtmlScanner,
  hasFindingAtOrAbove,
  type BuildScanReport,
  type HtmlScanner,
  type Severity,
} from './scan.js';

export interface AriadaAstroOptions {
  outputFile?: string;
  textOutputFile?: string;
  failOn?: Severity | false;
  scanner?: HtmlScanner;
}

export interface AstroBuildDoneOptions {
  dir: URL;
}

export interface AstroIntegrationLike {
  name: string;
  hooks: {
    'astro:build:done': (options: AstroBuildDoneOptions) => Promise<void>;
  };
}

export function ariada(options: AriadaAstroOptions = {}): AstroIntegrationLike {
  return {
    name: '@ariada-org/astro',
    hooks: {
      'astro:build:done': async ({ dir }) => {
        const buildDir = fileURLToPath(dir);
        const report = await scanAstroBuild(buildDir, options);
        const jsonPath = resolve(buildDir, options.outputFile ?? 'ariada-report.json');
        await writeJsonReport(report, jsonPath);

        if (options.textOutputFile) {
          await writeFile(resolve(buildDir, options.textOutputFile), renderTextReport(report), 'utf8');
        }

        if (options.failOn !== false && hasFindingAtOrAbove(report, options.failOn ?? 'serious')) {
          throw new Error(`Ariada Astro build gate failed with ${report.summary.total} finding(s).`);
        }
      },
    },
  };
}

export default ariada;

export async function scanAstroBuild(
  buildDir: string,
  options: Pick<AriadaAstroOptions, 'scanner'> = {},
): Promise<BuildScanReport> {
  const scanner = options.scanner ?? defaultHtmlScanner;
  const htmlFiles = await listHtmlFiles(buildDir);
  const pages = [];

  for (const filePath of htmlFiles) {
    const html = await readFile(filePath, 'utf8');
    pages.push(await scanner({ filePath, html }));
  }

  return buildReport(pages);
}

async function listHtmlFiles(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listHtmlFiles(fullPath)));
    } else if (entry.isFile() && entry.name.endsWith('.html')) {
      files.push(fullPath);
    }
  }

  return files.sort();
}

export type { BuildScanReport, HtmlScanner, Severity };
