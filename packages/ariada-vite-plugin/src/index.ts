// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
/* eslint-disable jsdoc/require-jsdoc */

import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

import {
  buildReport,
  defaultHtmlScanner,
  hasFindingAtOrAbove,
  type HtmlScanner,
  type Severity,
  type ViteScanReport,
} from './scan.js';

export interface AriadaViteOptions {
  outDir?: string;
  reportFile?: string;
  failOn?: Severity | false;
  scanDevHtml?: boolean;
  scanner?: HtmlScanner;
}

export interface ViteConfigResolvedLike {
  root: string;
  build: {
    outDir: string;
  };
}

export interface VitePluginLike {
  name: string;
  enforce: 'post';
  configResolved(config: ViteConfigResolvedLike): void;
  transformIndexHtml(html: string): Promise<string>;
  closeBundle(): Promise<void>;
}

export function ariadaVite(options: AriadaViteOptions = {}): VitePluginLike {
  const scanner = options.scanner ?? defaultHtmlScanner;
  const devPages = new Map<string, string>();
  let config: ViteConfigResolvedLike = { root: process.cwd(), build: { outDir: 'dist' } };

  return {
    name: '@ariada-org/vite-plugin',
    enforce: 'post',
    configResolved(nextConfig) {
      config = nextConfig;
    },
    async transformIndexHtml(html) {
      if (options.scanDevHtml ?? true) {
        devPages.set(resolve(config.root, 'index.html'), html);
      }
      return html;
    },
    async closeBundle() {
      const buildDir = resolve(config.root, options.outDir ?? config.build.outDir);
      const report = await scanViteOutput(buildDir, { scanner });
      for (const [filePath, html] of devPages) {
        report.pages.push(await scanner({ filePath, html }));
      }
      report.summary = buildReport(report.pages, report.generatedAt).summary;

      const reportPath = resolve(buildDir, options.reportFile ?? 'ariada-vite-report.json');
      await mkdir(dirname(reportPath), { recursive: true });
      await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

      if (options.failOn !== false && hasFindingAtOrAbove(report, options.failOn ?? 'serious')) {
        throw new Error(`Ariada Vite build gate failed with ${report.summary.total} finding(s).`);
      }
    },
  };
}

export default ariadaVite;

export async function scanViteOutput(
  buildDir: string,
  options: Pick<AriadaViteOptions, 'scanner'> = {},
): Promise<ViteScanReport> {
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

  return files.sort((a, b) => a.localeCompare(b));
}

export type { HtmlScanner, Severity, ViteScanReport };
