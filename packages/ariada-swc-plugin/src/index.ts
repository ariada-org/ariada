// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
/* eslint-disable jsdoc/require-jsdoc */

export type Severity = 'minor' | 'moderate' | 'serious' | 'critical';

export interface SwcFinding {
  ruleId: string;
  severity: Severity;
  message: string;
}

export interface SwcTransformResult {
  code: string;
  map?: string;
  ariadaFindings: SwcFinding[];
}

export type SwcTransform = (code: string, options?: unknown) => { code: string; map?: string };
export type JsxScanner = (input: { filePath?: string; markup: string }) => SwcFinding[];

export interface AriadaSwcOptions {
  filename?: string;
  failOn?: Severity | false;
  transformSync?: SwcTransform;
  scanner?: JsxScanner;
  swcOptions?: unknown;
}

const severityRank: Record<Severity, number> = { minor: 1, moderate: 2, serious: 3, critical: 4 };

export function transformWithAriada(code: string, options: AriadaSwcOptions = {}): SwcTransformResult {
  const transform = options.transformSync ?? missingSwc;
  const transformed = transform(code, options.swcOptions);
  const markup = extractJsxTags(code);
  const scannerInput: { filePath?: string; markup: string } = { markup };
  if (options.filename) scannerInput.filePath = options.filename;
  const findings = (options.scanner ?? defaultScanner)(scannerInput);

  if (options.failOn !== false) {
    const failOn = options.failOn ?? 'serious';
    if (findings.some((finding) => severityRank[finding.severity] >= severityRank[failOn])) {
      throw new Error(`Ariada SWC wrapper gate failed with ${findings.length} finding(s).`);
    }
  }

  return { ...transformed, ariadaFindings: findings };
}

export function extractJsxTags(code: string): string {
  return [...code.matchAll(/<([A-Za-z][A-Za-z0-9]*)\b/g)].map((match) => `<${match[1]}>`).join('');
}

function missingSwc(): never {
  throw new Error('Pass @swc/core transformSync as transformSync; this wrapper is not a native SWC Wasm plugin.');
}

const defaultScanner: JsxScanner = () => [];
