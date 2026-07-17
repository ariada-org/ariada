// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
/* eslint-disable jsdoc/require-jsdoc */

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

export interface AriadaWebpackOptions {
  failOn?: Severity | false;
  scanner?: HtmlScanner;
}

interface CompilationLike {
  assets: Record<string, { source: () => string | Buffer }>;
  warnings: Error[];
  errors: Error[];
}

interface CompilerLike {
  hooks: {
    afterEmit: {
      tapPromise(name: string, callback: (compilation: CompilationLike) => Promise<void>): void;
    };
  };
}

const severityRank: Record<Severity, number> = { minor: 1, moderate: 2, serious: 3, critical: 4 };

export class AriadaWebpackPlugin {
  readonly #options: AriadaWebpackOptions;

  constructor(options: AriadaWebpackOptions = {}) {
    this.#options = options;
  }

  apply(compiler: CompilerLike): void {
    compiler.hooks.afterEmit.tapPromise('@ariada-org/webpack-plugin', async (compilation) => {
      const results = await scanAssets(compilation.assets, this.#options.scanner ?? defaultScanner);
      const findings = results.flatMap((result) => result.findings);
      const diagnostics = findings.map((finding) => new Error(formatFinding(finding)));
      if (this.#options.failOn !== false && breaches(findings, this.#options.failOn ?? 'serious')) {
        compilation.errors.push(...diagnostics);
      } else {
        compilation.warnings.push(...diagnostics);
      }
    });
  }
}

export default AriadaWebpackPlugin;

export async function scanAssets(
  assets: CompilationLike['assets'],
  scanner: HtmlScanner = defaultScanner,
): Promise<AriadaScanResult[]> {
  const results: AriadaScanResult[] = [];
  for (const [filePath, asset] of Object.entries(assets)) {
    if (!filePath.endsWith('.html')) continue;
    results.push(await scanner({ filePath, html: String(asset.source()) }));
  }
  return results;
}

function formatFinding(finding: AriadaFinding): string {
  return `[ariada:${finding.severity}] ${finding.filePath} ${finding.ruleId}: ${finding.message}`;
}

function breaches(findings: AriadaFinding[], threshold: Severity): boolean {
  return findings.some((finding) => severityRank[finding.severity] >= severityRank[threshold]);
}

const defaultScanner: HtmlScanner = ({ filePath }) => ({ filePath, findings: [] });
