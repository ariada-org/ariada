// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
/* eslint-disable jsdoc/require-jsdoc */

export type Severity = 'minor' | 'moderate' | 'serious' | 'critical';

export interface JsxFinding {
  ruleId: string;
  severity: Severity;
  message: string;
}

export type JsxScanner = (input: { filePath?: string; markup: string }) => JsxFinding[] | Promise<JsxFinding[]>;

export interface AriadaBabelOptions {
  failOn?: Severity | false;
  scanner?: JsxScanner;
}

interface BabelPass {
  opts: AriadaBabelOptions;
  file: {
    opts: { filename?: string };
    metadata: Record<string, unknown>;
  };
}

interface BabelPathLike {
  node: {
    name: unknown;
  };
}

interface BabelPluginLike {
  name: string;
  pre(this: BabelPass): void;
  visitor: {
    JSXOpeningElement(this: BabelPass, path: BabelPathLike): void;
  };
  post(this: BabelPass): void;
}

const severityRank: Record<Severity, number> = { minor: 1, moderate: 2, serious: 3, critical: 4 };

export default function ariadaBabel(): BabelPluginLike {
  return {
    name: '@ariada-org/babel-plugin',
    pre() {
      this.file.metadata['ariadaMarkup'] = [];
    },
    visitor: {
      JSXOpeningElement(this: BabelPass, path) {
        const tagName = jsxName(path.node.name);
        if (tagName) (this.file.metadata['ariadaMarkup'] as string[]).push(`<${tagName}>`);
      },
    },
    post() {
      const markup = (this.file.metadata['ariadaMarkup'] as string[]).join('');
      const scanner = this.opts.scanner ?? defaultScanner;
      const scannerInput: { filePath?: string; markup: string } = { markup };
      if (this.file.opts.filename) scannerInput.filePath = this.file.opts.filename;
      const findings = scanner(scannerInput);
      if (findings instanceof Promise) {
        throw new Error('Ariada Babel scanner must be synchronous because Babel transform hooks are synchronous.');
      }
      this.file.metadata['ariadaFindings'] = findings;
      if (this.opts.failOn !== false) {
        const failOn = this.opts.failOn ?? 'serious';
        if (findings.some((finding: JsxFinding) => severityRank[finding.severity] >= severityRank[failOn])) {
          throw new Error(`Ariada Babel gate failed with ${findings.length} finding(s).`);
        }
      }
    },
  };
}

function jsxName(node: unknown): string | undefined {
  if (!isRecord(node)) return undefined;
  if (node['type'] === 'JSXIdentifier' && typeof node['name'] === 'string') return node['name'];
  if (node['type'] === 'JSXMemberExpression') return jsxName(node['property']);
  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

const defaultScanner: JsxScanner = () => [];
