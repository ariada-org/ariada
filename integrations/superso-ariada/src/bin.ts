#!/usr/bin/env node
// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Recovered from `dist/bin.js`. Checked with
// `bash scripts/sverit-vosstanovlennoe.sh`.

import { evaluateGate, readAriadaResult, scanSuperSoSite, type ScanOptions, type Severity } from './index.js';

/**
 * Read the command line.
 *
 * An unknown or incomplete flag is one error, not two, because from the
 * caller's side they are the same mistake: a flag that will not do what they
 * meant.
 *
 * @param argv - the arguments after the command name
 * @returns the options
 */
function parseArgs(argv: string[]): ScanOptions {
  if (argv[0] !== 'scan' || !argv[1])
    throw new Error(
      'Usage: superso-ariada scan <published-url> [--output-dir dir] [--threshold severity] [--cli-bin bin]',
    );
  const options: ScanOptions = { publishedUrl: argv[1] };
  for (let index = 2; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (!value || !['--output-dir', '--threshold', '--cli-bin'].includes(flag ?? ''))
      throw new Error(`Unknown or incomplete option: ${flag}`);
    if (flag === '--output-dir') options.outputDirectory = value;
    if (flag === '--threshold') options.severityThreshold = value as Severity;
    if (flag === '--cli-bin') options.cliBin = value;
  }
  return options;
}

/**
 * Scan, read the report, and answer with the gate's code.
 *
 * A non-zero exit from the scanner is returned as it is rather than replaced:
 * the caller learns that the scan failed, not that the gate did.
 *
 * @returns the exit code
 */
async function main(): Promise<number> {
  const options = parseArgs(process.argv.slice(2));
  const outputDirectory = options.outputDirectory ?? 'ariada-output';
  const cliExit = await scanSuperSoSite(options);
  if (cliExit !== 0) return cliExit;
  const result = await readAriadaResult(
    outputDirectory,
    options.publishedUrl,
    options.severityThreshold,
  );
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  return evaluateGate(result);
}

main().catch((error) => {
  process.stderr.write(
    `superso-ariada: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 2;
});
