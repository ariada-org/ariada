// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Recovered from `dist/scanner.js` and `dist/scanner.d.ts`. The source this was
// built from was never committed; the compiled output is `tsc` with the types
// stripped, so the shapes come back from the declaration file and the bodies
// are the compiled ones. Checked with
// `bash scripts/sverit-vosstanovlennoe.sh`.
//
// The scan runs at the lowest threshold and the build's own threshold is applied
// afterwards, so a passing component still leaves a complete record and changing
// what fails a build needs no rescan.
//
// The output directory is emptied first: a scan that dies before writing leaves
// nothing, which is honest, where the previous component's report left in place
// would be read as this one's.
//
// The scanner is reached through its real entry point and the absence of that
// entry point is an explicit failure. This integration claims to run the actual
// scanner, and a claim like that has to break loudly when it stops being true.

import { mkdir, readFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PassThrough } from 'node:stream';

import { parseAriadaScanJson } from './report.js';
import type { ParsedAriadaScan } from './types.js';

export async function scanRenderedPage(url: string, outputDir: string, timeoutMs: number): Promise<ParsedAriadaScan> {
  await rm(outputDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });
  const runScan = await loadAriadaRunScan();
  const stdout = captureStream();
  const stderr = captureStream();
  const exitCode = await runScan(url, {
    outputDir,
    browser: 'chromium',
    format: 'json',
    severityThreshold: 'minor',
    timeoutMs,
  }, stdout.stream, stderr.stream, realCoreScan);
  if (exitCode !== 0 && exitCode !== 1) {
    throw new Error(`Ariada CLI scan failed with exit ${exitCode}: ${stderr.text() || stdout.text() || 'no diagnostics'}`);
  }
  const reportPath = resolve(outputDir, 'scan.json');
  let reportText: string;
  try {
    reportText = await readFile(reportPath, 'utf8');
  }
  catch (error) {
    throw new Error(`Ariada CLI did not write ${reportPath}`, { cause: error });
  }
  return parseAriadaScanJson(reportText, url, exitCode);
}

async function loadAriadaRunScan() {
  const cliEntry = import.meta.resolve('@ariada-org/cli');
  const moduleUrl = new URL('./subcommands/scan.js', cliEntry).href;
  const module = (await import(moduleUrl)) as { runScan?: unknown };
  if (typeof module.runScan !== 'function')
    throw new Error('@ariada-org/cli does not expose its real runScan module');
  return module.runScan as (
    url: string,
    options: Record<string, unknown>,
    stdout: NodeJS.WritableStream,
    stderr: NodeJS.WritableStream,
    coreScan: unknown,
  ) => Promise<number>;
}

const realCoreScan = async (url: string, options: Record<string, unknown>) => {
  const [core, rules] = await Promise.all([
    import('@ariada-org/core-playwright'),
    import('@ariada-org/rules-axe'),
  ]);
  const scan = core.scan;
  const result = await scan(url, {
    ...options,
    allowPrivate: true,
    analyzers: [rules.createA11yAnalyzer()],
    screenshot: false,
  });
  return result;
};

function captureStream(): { stream: PassThrough; text: () => string } {
  const stream = new PassThrough();
  let output = '';
  stream.setEncoding('utf8');
  stream.on('data', (chunk: string) => {
    output += chunk;
    if (Buffer.byteLength(output) > 2_000_000)
      stream.destroy(new Error('Ariada CLI output exceeded 2 MB'));
  });
  return { stream, text: () => output.trim() };
}
