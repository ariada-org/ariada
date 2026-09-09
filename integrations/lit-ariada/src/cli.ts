#!/usr/bin/env node
// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Recovered from `dist/cli.js` and `dist/cli.d.ts`. The source this was built
// from was never committed; the compiled output is `tsc` with the types
// stripped, so the shape comes back from the declaration file and the body is
// the compiled one. Checked with `bash scripts/sverit-vosstanovlennoe.sh`.
//
// A flag standing where a value should be is refused, so `--component --browser`
// does not scan for an element called `--browser`. An unknown option is refused
// rather than skipped, because a misspelled flag that is ignored produces a scan
// under a default nobody chose and says nothing about it.
//
// Three exit codes for three different readers: the page's verdict passes
// through, 2 says the command line was wrong, 3 says something else broke. A
// pipeline that treated every non-zero exit as an inaccessible component could
// not tell a typo from a finding.
//
// The failure is one line of JSON on the error stream rather than a stack trace,
// because this is run from a test script whose output another program reads.

import { LitAriadaError } from './errors.js';
import { scanLitFixture } from './scanner.js';
import type { AriadaSeverity, LitBrowser, LitScanOptions } from './types.js';

const HELP = `Usage: lit-ariada <fixture-url> --component <custom-element> [options]

Options:
  --browser <chromium|firefox|webkit>       Browser engine (default: chromium)
  --fail-on-severity <level>                minor|moderate|serious|critical
  --output-dir <path>                       Artifact directory
  --timeout-ms <milliseconds>               1000..120000
  -h, --help                                Show this help
`;

function requiredValue(args: readonly string[], index: number, option: string): string {
  const value = args[index + 1];
  if (value === undefined || value.startsWith('--')) {
    throw new LitAriadaError('INVALID_INPUT', `${option} requires a value`);
  }
  return value;
}

function parseArgs(args: readonly string[]): LitScanOptions | undefined {
  if (args.includes('--help') || args.includes('-h')) return undefined;
  const fixtureUrl = args[0];
  if (fixtureUrl === undefined || fixtureUrl.startsWith('-')) {
    throw new LitAriadaError('INVALID_INPUT', 'Missing fixture URL');
  }
  let componentSelector: string | undefined;
  let browser: LitBrowser | undefined;
  let severityThreshold: AriadaSeverity | undefined;
  let outputDirectory: string | undefined;
  let timeoutMs: number | undefined;
  for (let index = 1; index < args.length; index += 1) {
    const option = args[index];
    if (option === '--component') componentSelector = requiredValue(args, index++, option);
    else if (option === '--browser') browser = requiredValue(args, index++, option) as LitBrowser;
    else if (option === '--fail-on-severity') {
      severityThreshold = requiredValue(args, index++, option) as AriadaSeverity;
    }
    else if (option === '--output-dir') outputDirectory = requiredValue(args, index++, option);
    else if (option === '--timeout-ms') {
      timeoutMs = Number(requiredValue(args, index++, option));
    }
    else throw new LitAriadaError('INVALID_INPUT', `Unknown option: ${String(option)}`);
  }
  if (componentSelector === undefined) {
    throw new LitAriadaError('INVALID_INPUT', '--component is required');
  }
  return {
    fixtureUrl,
    componentSelector,
    ...(browser === undefined ? {} : { browser }),
    ...(severityThreshold === undefined ? {} : { severityThreshold }),
    ...(outputDirectory === undefined ? {} : { outputDirectory }),
    ...(timeoutMs === undefined ? {} : { timeoutMs }),
  };
}

try {
  const options = parseArgs(process.argv.slice(2));
  if (options === undefined) {
    process.stdout.write(HELP);
  }
  else {
    const result = await scanLitFixture(options);
    process.stdout.write(`${JSON.stringify({
      fixtureUrl: result.fixtureUrl,
      componentSelector: result.componentSelector,
      findings: result.componentFindings.length,
      failOnSeverity: result.decision.failOnSeverity,
      exitCode: result.decision.exitCode,
      artifact: result.resultArtifactPath,
    })}\n`);
    process.exitCode = result.decision.exitCode;
  }
}
catch (error) {
  const invalid = error instanceof LitAriadaError && error.code === 'INVALID_INPUT';
  process.stderr.write(`${JSON.stringify({
    level: 'error',
    code: error instanceof LitAriadaError ? error.code : 'UNEXPECTED_ERROR',
    message: error instanceof Error ? error.message : String(error),
  })}\n`);
  process.exitCode = invalid ? 2 : 3;
}
