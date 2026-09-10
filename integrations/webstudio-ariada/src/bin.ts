#!/usr/bin/env node
// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Recovered from `dist/bin.js` and `dist/bin.d.ts`. The source this was built
// from was never committed; the compiled output is `tsc` with the types
// stripped, so the shapes come back from the declaration file and the bodies
// are the compiled ones. It is released from that comparison: the digest no
// longer has to match, and what holds this file now is the behaviour described
// in the tests beside it, written while the
// comparison still agreed, so it describes the code that ships rather than the
// intent behind it.
//
// AN UNKNOWN OPTION IS REFUSED rather than ignored. An ignored option is a
// request the caller believes was honoured, and the difference shows up as a
// scan run under settings nobody chose.
//
// The scanner's own exit code is returned before the report is read: a scanner
// that did not run has nothing to report, and reading its previous output would
// give a verdict about a run that did not happen.

import {
  listExportedPages,
  readAriadaResult,
  scanExportedSite,
  evaluateGate,
  type ScanOptions,
} from './index.js';

function parseArgs(argv: readonly string[]): ScanOptions {
  if (argv[0] !== 'scan')
    throw new Error(
      'Usage: webstudio-ariada scan <export-directory> [--output-dir dir] [--threshold severity] [--cli-bin bin]',
    );
  const exportDirectory = argv[1];
  if (!exportDirectory) throw new Error('Missing Webstudio export directory');
  const options: ScanOptions = { exportDirectory };
  for (let index = 2; index < argv.length; index += 1) {
    const value = argv[index + 1];
    if (argv[index] === '--output-dir' && value) options.outputDirectory = value;
    else if (argv[index] === '--threshold' && value) {
      options.severityThreshold = value as ScanOptions['severityThreshold'];
    } else if (argv[index] === '--cli-bin' && value) options.cliBin = value;
    else if (argv[index]?.startsWith('--')) throw new Error(`Unknown option: ${argv[index]}`);
    else continue;
    index += 1;
  }
  return options;
}

async function main(): Promise<number> {
  const options = parseArgs(process.argv.slice(2));
  const outputDirectory = options.outputDirectory ?? 'ariada-output';
  const pages = (await listExportedPages(options.exportDirectory)).map(
    (page) => new URL(`file://${page}`).href,
  );
  const exitCode = await scanExportedSite(options);
  if (exitCode !== 0) return exitCode;
  const result = await readAriadaResult(outputDirectory, pages, options.severityThreshold);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  return evaluateGate(result);
}

// THE VALUE `main` RETURNS IS THE ANSWER, and it used to be thrown away. It
// carries both the gate's verdict — nought for a site that passed the threshold,
// one for a site that did not — and the scanner's own code when the scanner never
// reached a verdict. Neither reached the process, so every run that got as far as
// scanning exited nought, and "got as far as scanning" quietly includes "the site
// is inaccessible". A build step checking the exit code saw success either way.
//
// The module computes the verdict itself rather than trusting the scanner's,
// precisely so the report and the exit code cannot disagree. Losing it on the
// last line undid that.
main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error: unknown) => {
    process.stderr.write(
      `webstudio-ariada: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 2;
  });
