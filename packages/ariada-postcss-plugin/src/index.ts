// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
/* eslint-disable jsdoc/require-jsdoc */

export type Severity = 'minor' | 'moderate' | 'serious' | 'critical';

export interface CssFinding {
  ruleId: string;
  severity: Severity;
  message: string;
  line?: number;
  column?: number;
}

export type CssScanner = (input: { css: string; from?: string }) => CssFinding[] | Promise<CssFinding[]>;

export interface AriadaPostcssOptions {
  scanner?: CssScanner;
}

export function ariadaPostcss(options: AriadaPostcssOptions = {}) {
  const scanner = options.scanner ?? defaultScanner;
  return {
    postcssPlugin: '@ariada-org/postcss-plugin',
    async Once(root: { toString: () => string; source?: { input?: { file?: string } } }, helpers: { result: { warn: (message: string, options?: { line?: number; column?: number }) => void } }) {
      const input: { css: string; from?: string } = { css: root.toString() };
      if (root.source?.input?.file) input.from = root.source.input.file;
      const findings = await scanner(input);
      for (const finding of findings) {
        const warningOptions: { line?: number; column?: number } = {};
        if (finding.line !== undefined) warningOptions.line = finding.line;
        if (finding.column !== undefined) warningOptions.column = finding.column;
        helpers.result.warn(`[ariada:${finding.severity}] ${finding.ruleId}: ${finding.message}`, warningOptions);
      }
    },
  };
}

ariadaPostcss.postcss = true;

export default ariadaPostcss;

const defaultScanner: CssScanner = () => [];
