#!/usr/bin/env node
// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Recovered from `dist/cli.js` and `dist/cli.d.ts`. The source this was built
// from was never committed; the compiled output is `tsc` with the types
// stripped, so the shapes come back from the declaration file and the bodies
// are the compiled ones.
//
// It has since been released from that comparison, and the wording of that
// sentence matters: the guard reads for it literally, so it stays on one line.
//
// HOW IT IS HELD NOW. While the comparison still matched — while this was
// provably the shipped module — behaviour tests were written against it, and
// only then was the flag-reading split out, because the whole of it sat at
// twenty-one against a limit of fifteen. Removing the duplicate-flag refusal,
// or letting a flag pass as a value, fails exactly one test each.
//
// The guarantee lives in `tests/scripts/recovered-turborepo-task.test.ts`, and
// the release is recorded in `tests/scripts/vypushchennye-iz-slicheniya.txt`.
//
// THREE REFUSALS HERE ARE DELIBERATE, AND EACH STOPS A SILENCE.
//
// A flag standing where a value should be is a forgotten value, not a value —
// so `--url --browser` is refused rather than scanning an address called
// `--browser`.
//
// A repeated flag is refused rather than taking the last one. Two contradictory
// thresholds in one command line mean somebody believes both, and quietly
// honouring the second publishes a result under the wrong one.
//
// An unknown argument is refused rather than ignored. A misspelled flag that is
// skipped produces a scan with a default nobody chose, and the report says
// nothing about it.
//
// AND THE EXIT CODES ARE THREE THINGS, NOT ONE. 0 or 1 is the page's verdict —
// carried up from the task, and flattened to 0 by `--report-only`. 2 is "this
// command line is wrong". 3 is "something else broke". A pipeline that treats
// every non-zero exit as a failing page cannot tell an inaccessible page from a
// typo, and the two need different people.

import { realpath } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

import {
  ARIADA_TURBO_VERSION,
  AriadaTaskError,
  runAriadaTask,
} from './index.js';
import type { AriadaTaskOptions, BrowserName, Severity } from './index.js';

export interface ParsedArguments {
  readonly action: 'run' | 'help' | 'version';
  readonly options?: AriadaTaskOptions;
}

const HELP = `ariada-turbo ${ARIADA_TURBO_VERSION}

Run the real Ariada scanner as a cacheable Turborepo package task.

Usage:
  ariada-turbo --html <file> [options]
  ariada-turbo --url <http(s)-url> [options]

Options:
  --output <file>       Findings artifact (default: .ariada/findings.json)
  --browser <name>      chromium, firefox, or webkit (default: chromium)
  --fail-on <severity>  minor, moderate, serious, or critical (default: moderate)
  --timeout-ms <ms>     Navigation timeout, 1..300000 (default: 30000)
  --report-only         Write findings but exit 0; semantic exit remains in the artifact
  --help                Show this help
  --version             Show package version
`;

function requireValue(args: readonly string[], index: number, flag: string): string {
  const value = args[index + 1];
  if (value === undefined || value.startsWith('--')) {
    throw new AriadaTaskError('INVALID_OPTIONS', `${flag} requires a value`);
  }
  return value;
}

const BOOLEAN_FLAGS = new Set(['--report-only']);
const VALUE_FLAGS = new Set([
  '--url',
  '--html',
  '--output',
  '--browser',
  '--fail-on',
  '--timeout-ms',
]);

/**
 * The flags given, refusing the three ways a command line lies quietly.
 *
 * An unknown flag is refused rather than skipped, a repeat is refused rather
 * than resolved to the last one, and a flag standing where a value belongs is
 * treated as the forgotten value it is. Each of those, ignored, produces a scan
 * under settings nobody chose and a report that says nothing about it.
 */
function collectFlags(args: readonly string[]): Record<string, string | true> {
  const values: Record<string, string | true> = {};
  const seen = new Set<string>();
  for (let index = 0; index < args.length; index += 1) {
    const flag = args[index];
    if (flag === undefined || (!BOOLEAN_FLAGS.has(flag) && !VALUE_FLAGS.has(flag))) {
      throw new AriadaTaskError('INVALID_OPTIONS', `Unknown argument: ${String(flag)}`);
    }
    if (seen.has(flag)) throw new AriadaTaskError('INVALID_OPTIONS', `Duplicate argument: ${flag}`);
    seen.add(flag);
    if (BOOLEAN_FLAGS.has(flag)) {
      values[flag] = true;
      continue;
    }
    values[flag] = requireValue(args, index, flag);
    index += 1;
  }
  return values;
}

export function parseArguments(args: readonly string[]): ParsedArguments {
  if (args.length === 1 && args[0] === '--help') return { action: 'help' };
  if (args.length === 1 && args[0] === '--version') return { action: 'version' };
  const values = collectFlags(args);
  const timeoutRaw = values['--timeout-ms'];
  if (typeof timeoutRaw === 'string' && !/^\d+$/.test(timeoutRaw)) {
    throw new AriadaTaskError('INVALID_OPTIONS', '--timeout-ms must be a positive integer');
  }
  return {
    action: 'run',
    options: {
      ...(typeof values['--url'] === 'string' ? { url: values['--url'] } : {}),
      ...(typeof values['--html'] === 'string' ? { html: values['--html'] } : {}),
      ...(typeof values['--output'] === 'string' ? { output: values['--output'] } : {}),
      ...(typeof values['--browser'] === 'string'
        ? { browser: values['--browser'] as BrowserName }
        : {}),
      ...(typeof values['--fail-on'] === 'string'
        ? { failOn: values['--fail-on'] as Severity }
        : {}),
      ...(typeof timeoutRaw === 'string' ? { timeoutMs: Number(timeoutRaw) } : {}),
      ...(values['--report-only'] === true ? { reportOnly: true } : {}),
    },
  };
}

export async function main(args: readonly string[]): Promise<number> {
  try {
    const parsed = parseArguments(args);
    if (parsed.action === 'help') {
      process.stdout.write(HELP);
      return 0;
    }
    if (parsed.action === 'version') {
      process.stdout.write(`${ARIADA_TURBO_VERSION}\n`);
      return 0;
    }
    const result = await runAriadaTask(parsed.options ?? {});
    process.stdout.write(
      `${JSON.stringify({
        artifact: result.outputPath,
        findings: result.artifact.summary.total,
        semanticExitCode: result.semanticExitCode,
        processExitCode: result.processExitCode,
      })}\n`,
    );
    return result.processExitCode;
  } catch (error) {
    const taskError = error instanceof AriadaTaskError ? error : undefined;
    process.stderr.write(
      `${JSON.stringify({
        error: taskError?.code ?? 'UNEXPECTED_ERROR',
        message: error instanceof Error ? error.message : String(error),
        ...(taskError === undefined ? {} : { details: taskError.details }),
      })}\n`,
    );
    return taskError?.code === 'INVALID_OPTIONS' ? 2 : 3;
  }
}

/**
 * Whether this module was started as a program rather than imported.
 *
 * The real path is resolved first, because a package's executable is usually a
 * symbolic link and comparing the link's address to the module's would answer
 * no every time it was installed rather than run from source.
 */
async function isDirectInvocation(): Promise<boolean> {
  if (process.argv[1] === undefined) return false;
  try {
    return import.meta.url === pathToFileURL(await realpath(process.argv[1])).href;
  } catch {
    return false;
  }
}

if (await isDirectInvocation()) {
  process.exitCode = await main(process.argv.slice(2));
}
