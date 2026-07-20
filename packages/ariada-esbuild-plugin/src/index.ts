// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
/* eslint-disable jsdoc/require-jsdoc */

import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

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

export interface AriadaEsbuildOptions {
  outdir?: string;
  failOn?: Severity | false;
  scanner?: HtmlScanner;
}

export interface EsbuildPluginLike {
  name: string;
  setup(build: {
    initialOptions: { outdir?: string; outfile?: string };
    onEnd(callback: () => Promise<{ warnings?: unknown[]; errors?: unknown[] } | void>): void;
  }): void;
}

const severityRank: Record<Severity, number> = { minor: 1, moderate: 2, serious: 3, critical: 4 };

export function ariadaEsbuild(options: AriadaEsbuildOptions = {}): EsbuildPluginLike {
  return {
    name: '@ariada-org/esbuild-plugin',
    setup(build) {
      build.onEnd(async () => {
        const outputDir = resolve(options.outdir ?? build.initialOptions.outdir ?? '.');
        const results = await scanOutput(outputDir, options.scanner ?? defaultScanner);
        const findings = results.flatMap((result) => result.findings);
        const diagnostics = findings.map(toEsbuildDiagnostic);
        if (options.failOn !== false && breaches(findings, options.failOn ?? 'serious')) {
          return { errors: diagnostics };
        }
        return { warnings: diagnostics };
      });
    },
  };
}

export default ariadaEsbuild;

export async function scanOutput(root: string, scanner: HtmlScanner = defaultScanner): Promise<AriadaScanResult[]> {
  const files = await listHtmlFiles(root);
  const results: AriadaScanResult[] = [];
  for (const filePath of files) {
    results.push(await scanner({ filePath, html: await readFile(filePath, 'utf8') }));
  }
  return results;
}

function toEsbuildDiagnostic(finding: AriadaFinding): { text: string; location: { file: string } } {
  return {
    text: `[ariada:${finding.severity}] ${finding.ruleId}: ${finding.message}`,
    location: { file: finding.filePath },
  };
}

function breaches(findings: AriadaFinding[], threshold: Severity): boolean {
  const minimum = severityRank[threshold];
  return findings.some((finding) => severityRank[finding.severity] >= minimum);
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
