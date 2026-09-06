#!/usr/bin/env node
// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Recovered from `dist/cli.js` and `dist/cli.d.ts`. The source this was built
// from was never committed; the compiled output is `tsc` with the types
// stripped, so the shape comes back from the declaration file and the bodies are
// the compiled ones.
//
// This module has since been released from that comparison.
//
// HOW IT IS HELD NOW. Nine behaviour tests written while the comparison still
// matched, then the flag collection split out of the reader. Nineteen against a
// limit of fifteen.
//
// The reader is not exported, so the tests drive the command itself — which is
// the only path a caller takes. Reaching in would test something nobody calls,
// and would keep passing after the entry point stopped using it.
//
// The guarantee lives in `tests/scripts/recovered-storybook-alt-cli.test.ts`,
// and the release is recorded in `tests/scripts/vypushchennye-iz-slicheniya.txt`.
//
// A repeated flag is refused rather than taking the last one: two contradictory
// values mean somebody believes both, and honouring the second silently gates a
// story library under a setting nobody chose. An unknown flag is refused for the
// same reason a misspelling should not become a default.
//
// `--fail-on none` is spelled as a word rather than a boolean, so a shell cannot
// turn it into something else on the way in.
//
// The module only runs itself when it was started as a program, so the command
// can be imported and called by a test without executing a scan on import.

import { pathToFileURL } from 'node:url';

import { runStories } from './runner.js';
import type { AriadaSeverity, StoryRunnerOptions } from './types.js';

const VERSION = '0.1.0';

export async function runCli(argv: readonly string[]): Promise<number> {
  if (argv.includes('--help') || argv.includes('-h')) {
    process.stdout.write(help());
    return 0;
  }
  if (argv.includes('--version') || argv.includes('-v')) {
    process.stdout.write(VERSION + '\n');
    return 0;
  }
  try {
    const options = parseArguments(argv);
    const report = await runStories(options);
    process.stdout.write('Ariada scanned ' +
      report.storyCount +
      ' ' +
      report.platform +
      ' stories: findings=' +
      report.findingCount +
      ' gate=' +
      (report.failed ? 'failed' : 'passed') +
      '\n');
    return report.failed ? 1 : 0;
  }
  catch (error) {
    process.stderr.write('ariada-stories: ' + (error instanceof Error ? error.message : String(error)) + '\n');
    return 2;
  }
}

const ALLOWED_FLAGS = new Set(['--platform', '--base-url', '--static-dir', '--manifest', '--report-dir', '--fail-on', '--timeout-ms']);

/**
 * The flags given, refusing the three command lines that mean something other
 * than what was typed.
 *
 * An unknown flag is refused rather than skipped, a repeat rather than resolved
 * to the last one, and a flag standing where a value belongs is treated as the
 * forgotten value it is. Each of those, let through, produces a scan under
 * settings nobody chose and a report that mentions none of it.
 */
function collectFlags(argv: readonly string[]): Map<string, string> {
  const values = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (flag === undefined || !ALLOWED_FLAGS.has(flag)) throw new TypeError('Unknown argument: ' + String(flag));
    if (values.has(flag)) throw new TypeError('Duplicate argument: ' + flag);
    const value = argv[index + 1];
    if (value === undefined || value.startsWith('--')) throw new TypeError('Missing value for ' + flag);
    values.set(flag, value);
    index += 1;
  }
  return values;
}

function parseArguments(argv: readonly string[]): StoryRunnerOptions {
  const values = collectFlags(argv);
  const platform = values.get('--platform');
  if (platform !== 'ladle' && platform !== 'histoire') throw new TypeError('--platform must be ladle or histoire');
  const failOnValue = values.get('--fail-on');
  const failOn = failOnValue === undefined
    ? undefined
    : failOnValue === 'none'
      ? false
      : failOnValue as AriadaSeverity;
  const timeoutValue = values.get('--timeout-ms');
  const timeoutMs = timeoutValue === undefined ? undefined : Number(timeoutValue);
  const baseUrl = values.get('--base-url');
  const staticDir = values.get('--static-dir');
  const manifest = values.get('--manifest');
  const reportDir = values.get('--report-dir');
  return {
    platform: platform,
    ...(baseUrl === undefined ? {} : { baseUrl }),
    ...(staticDir === undefined ? {} : { staticDir }),
    ...(manifest === undefined ? {} : { manifest }),
    ...(reportDir === undefined ? {} : { reportDir }),
    ...(failOn === undefined ? {} : { failOn }),
    ...(timeoutMs === undefined ? {} : { timeoutMs }),
  };
}

function help(): string {
  return [
    'Usage: ariada-stories --platform <ladle|histoire> (--base-url <url> | --static-dir <dir>) [options]',
    '',
    'Options:',
    '  --manifest <file>       Required deterministic story manifest for Histoire',
    '  --report-dir <dir>      Report output directory (default .ariada/storybook-alt)',
    '  --fail-on <severity>    minor|moderate|serious|critical|none (default serious)',
    '  --timeout-ms <number>   Navigation and readiness timeout (default 30000)',
    '  --help                  Show this help',
    '  --version               Show package version',
    '',
  ].join('\n');
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await runCli(process.argv.slice(2));
}
