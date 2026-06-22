// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
/* eslint-disable jsdoc/require-jsdoc */

export interface AriadaFinding {
  filePath: string;
  ruleId: string;
  severity: string;
  message: string;
}

export type ParcelScanner = (input: { distDir: string }) => AriadaFinding[] | Promise<AriadaFinding[]>;

export interface ParcelReporterOptions {
  scanner?: ParcelScanner;
}

export function createAriadaParcelReporter(options: ParcelReporterOptions = {}) {
  const scanner = options.scanner ?? defaultScanner;
  return {
    async report(event: { type: string; bundleGraph?: { getBundles: () => Array<{ target?: { distDir?: string } }> } }, api: { logger: { warn: (message: string) => void } }) {
      if (event.type !== 'buildSuccess') return;
      const distDirs = new Set(
        event.bundleGraph?.getBundles().map((bundle) => bundle.target?.distDir).filter((value): value is string => Boolean(value)) ?? [],
      );
      for (const distDir of distDirs) {
        const findings = await scanner({ distDir });
        for (const finding of findings) {
          api.logger.warn(`[ariada:${finding.severity}] ${finding.filePath} ${finding.ruleId}: ${finding.message}`);
        }
      }
    },
  };
}

export default createAriadaParcelReporter;

const defaultScanner: ParcelScanner = () => [];
