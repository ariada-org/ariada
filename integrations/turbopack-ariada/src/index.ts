// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
/* eslint-disable jsdoc/require-jsdoc */

import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

export interface AriadaCliResult {
  filePath: string;
  findings: number;
}

export type AriadaCliRunner = (input: { filePath: string; html: string }) => AriadaCliResult | Promise<AriadaCliResult>;

export interface NextPostBuildOptions {
  outputDir?: string;
  runner?: AriadaCliRunner;
}

export async function scanNextOutput(options: NextPostBuildOptions = {}): Promise<AriadaCliResult[]> {
  const outputDir = resolve(options.outputDir ?? '.next');
  const runner = options.runner ?? defaultRunner;
  const files = await listHtmlFiles(outputDir);
  const results: AriadaCliResult[] = [];
  for (const filePath of files) {
    results.push(await runner({ filePath, html: await readFile(filePath, 'utf8') }));
  }
  return results;
}

async function listHtmlFiles(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = join(root, entry.name);
    if (entry.isDirectory()) files.push(...(await listHtmlFiles(fullPath)));
    if (entry.isFile() && entry.name.endsWith('.html')) files.push(fullPath);
  }
  return files.sort();
}

const defaultRunner: AriadaCliRunner = ({ filePath }) => ({ filePath, findings: 0 });
