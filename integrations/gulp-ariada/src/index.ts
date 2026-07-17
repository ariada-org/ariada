// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
/* eslint-disable jsdoc/require-jsdoc */

import { Transform } from 'node:stream';

export interface VinylLike {
  path: string;
  contents: Buffer | null;
  ariadaFindings?: AriadaFinding[];
}

export interface AriadaFinding {
  ruleId: string;
  severity: string;
  message: string;
}

export type HtmlScanner = (input: { filePath: string; html: string }) => AriadaFinding[] | Promise<AriadaFinding[]>;

export interface GulpAriadaOptions {
  failOnFindings?: boolean;
  scanner?: HtmlScanner;
}

export function ariadaGulp(options: GulpAriadaOptions = {}): Transform {
  const scanner = options.scanner ?? defaultScanner;
  return new Transform({
    objectMode: true,
    async transform(file: VinylLike, _encoding, callback) {
      try {
        if (!file.contents || !file.path.endsWith('.html')) {
          callback(null, file);
          return;
        }
        const findings = await scanner({ filePath: file.path, html: file.contents.toString('utf8') });
        file.ariadaFindings = findings;
        if (options.failOnFindings && findings.length > 0) {
          callback(new Error(`Ariada Gulp gate failed with ${findings.length} finding(s).`));
          return;
        }
        callback(null, file);
      } catch (error) {
        callback(error instanceof Error ? error : new Error(String(error)));
      }
    },
  });
}

export default ariadaGulp;

const defaultScanner: HtmlScanner = () => [];
