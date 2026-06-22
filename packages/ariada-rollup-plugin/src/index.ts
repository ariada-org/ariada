// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
/* eslint-disable jsdoc/require-jsdoc */

import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

export type Severity = 'minor' | 'moderate' | 'serious' | 'critical';

export interface AriadaFinding {
  filePath: string;
  ruleId: string;
  severity: Severity;
  message: string;
}

export interface AriadaScanResult {
  filePath: string;
  findings: AriadaFinding[];
}

export type HtmlScanner = (input: { filePath: string; html: string }) => AriadaScanResult | Promise<AriadaScanResult>;

export interface AriadaRollupOptions {
  failOn?: Severity | false;
  scanner?: HtmlScanner;
}

export interface RollupPluginLike {
  name: string;
  writeBundle(
    this: RollupContextLike,
    options: { dir?: string; file?: string },
    bundle?: Record<string, { fileName: string; type: string; source?: string | Uint8Array }>,
  ): Promise<void>;
}

export interface RollupContextLike {
  warn(message: string): void;
  error(message: string): void;
}

const severityRank: Record<Severity, number> = { minor: 1, moderate: 2, serious: 3, critical: 4 };

export function ariadaRollup(options: AriadaRollupOptions = {}): RollupPluginLike {
  const scanner = options.scanner ?? defaultScanner;
  return {
    name: '@ariada-org/rollup-plugin',
    async writeBundle(this: RollupContextLike, outputOptions, bundle) {
      const results = bundle ? await scanBundle(bundle, scanner) : await scanDirectory(outputOptions.dir ?? '.', scanner);
      const findings = results.flatMap((result) => result.findings);
      for (const finding of findings) this.warn(formatFinding(finding));
      if (options.failOn !== false && breaches(findings, options.failOn ?? 'serious')) {
        this.error(`Ariada Rollup gate failed with ${findings.length} finding(s).`);
      }
    },
  };
}

export default ariadaRollup;

export async function scanBundle(
  bundle: Record<string, { fileName: string; type: string; source?: string | Uint8Array }>,
  scanner: HtmlScanner = defaultScanner,
): Promise<AriadaScanResult[]> {
  const results: AriadaScanResult[] = [];
  for (const item of Object.values(bundle)) {
    if (item.type !== 'asset' || !item.fileName.endsWith('.html') || typeof item.source !== 'string') continue;
    results.push(await scanner({ filePath: item.fileName, html: item.source }));
  }
  return results;
}

export async function scanDirectory(root: string, scanner: HtmlScanner = defaultScanner): Promise<AriadaScanResult[]> {
  const files = await listHtmlFiles(root);
  const results: AriadaScanResult[] = [];
  for (const filePath of files) {
    results.push(await scanner({ filePath, html: await readFile(filePath, 'utf8') }));
  }
  return results;
}

function formatFinding(finding: AriadaFinding): string {
  return `[ariada:${finding.severity}] ${finding.filePath} ${finding.ruleId}: ${finding.message}`;
}

function breaches(findings: AriadaFinding[], threshold: Severity): boolean {
  return findings.some((finding) => severityRank[finding.severity] >= severityRank[threshold]);
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

const defaultScanner: HtmlScanner = ({ filePath }) => ({ filePath, findings: [] });
