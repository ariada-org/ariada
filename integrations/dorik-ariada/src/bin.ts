#!/usr/bin/env node
// SPDX-License-Identifier: EUPL-1.2
//
// Recovered from `dist/bin.js`. Checked with
// `bash scripts/sverit-vosstanovlennoe.sh`.

import { evaluateGate, readAriadaResult, scanPublishedSite, type Severity } from './index.js';

type Options = {
  publishedUrl: string;
  outputDirectory?: string;
  threshold?: Severity;
  cliBin?: string;
};

/**
 * Read the command line.
 *
 * An unknown flag is an error rather than something to skip: a misspelled
 * threshold that is silently ignored is a gate running at a setting nobody
 * chose.
 *
 * @param argv - the arguments after the command name
 * @returns the options
 */
function parse(argv: string[]): Options {
  if (argv[0] !== 'scan' || !argv[1])
    throw new Error(
      'Usage: dorik-ariada scan <published-url> [--output-dir dir] [--threshold severity] [--cli-bin bin]',
    );
  const options: Options = { publishedUrl: argv[1] };
  for (let i = 2; i < argv.length; i += 2) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (!value) throw new Error(`Missing value for ${flag}`);
    if (flag === '--output-dir') options.outputDirectory = value;
    else if (flag === '--threshold') options.threshold = value as Severity;
    else if (flag === '--cli-bin') options.cliBin = value;
    else throw new Error(`Unknown option: ${flag}`);
  }
  return options;
}

const options = parse(process.argv.slice(2));
const outputDirectory = options.outputDirectory ?? 'ariada-output';
const exitCode = await scanPublishedSite(options);
if (exitCode !== 0) process.exitCode = exitCode;
else {
  const result = await readAriadaResult(outputDirectory, options.publishedUrl, options.threshold);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  process.exitCode = evaluateGate(result);
}
