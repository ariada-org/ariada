#!/usr/bin/env node
// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Recovered from `dist/cli.js` and `dist/cli.d.ts`. The source this was built
// from was never committed; the compiled output is `tsc` with the types
// stripped, so the shape comes back from the declaration file and the bodies are
// the compiled ones. Checked with `bash scripts/sverit-vosstanovlennoe.sh`.
//
// One command, and it exists for the case the build integration cannot cover: a
// page that is already deployed. It uses the same scanner path as the output
// target rather than a second one, so a result from here and a result from a
// build mean the same thing.
//
// `--fail-on false` is a real setting rather than an omission, and it is spelled
// as a word so it survives a shell that would otherwise swallow it. A team
// adopting this on an existing site needs to see everything before failing on
// anything.
//
// A wrong command line exits 2 and a finding exits 1, which is the difference a
// pipeline branches on. The run is wrapped so an unexpected failure exits 3 with
// its stack rather than being reported as a page with problems.

import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { hasFindingAtOrAbove } from './report.js';
import { scanRenderedPage } from './scanner.js';
import { ARIADA_SEVERITIES } from './types.js';
import type { AriadaSeverity } from './types.js';

const HELP = `stencil-ariada 0.1.0

Usage:
  stencil-ariada --help
  stencil-ariada --version
  stencil-ariada scan-url <http(s)-url> [--report-dir <dir>] [--fail-on <severity|false>] [--timeout-ms <ms>]

The Stencil build integration is exported as stencilAriada(). scan-url uses the
same real Ariada CLI/core-playwright/rules-axe contract as the output target.
`;

export async function runCli(argv: readonly string[]): Promise<number> {
  if (argv.length === 0 || argv.includes('--help') || argv.includes('-h')) {
    process.stdout.write(HELP);
    return 0;
  }
  if (argv.includes('--version') || argv.includes('-V')) {
    process.stdout.write('0.1.0\n');
    return 0;
  }
  if (argv[0] !== 'scan-url' || argv[1] === undefined) {
    process.stderr.write('Unknown command or missing URL. Run stencil-ariada --help.\n');
    return 2;
  }
  let url: URL;
  try {
    url = new URL(argv[1]);
  }
  catch {
    process.stderr.write('scan-url requires an absolute HTTP(S) URL.\n');
    return 2;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    process.stderr.write('scan-url requires an HTTP(S) URL.\n');
    return 2;
  }
  const reportDir = resolve(option(argv, '--report-dir') ?? '.ariada/stencil-url');
  const failRaw = option(argv, '--fail-on') ?? 'serious';
  const failOn = failRaw === 'false' ? false : failRaw as AriadaSeverity;
  if (failOn !== false && !ARIADA_SEVERITIES.includes(failOn)) {
    process.stderr.write(`--fail-on must be false or ${ARIADA_SEVERITIES.join(', ')}.\n`);
    return 2;
  }
  const timeoutRaw = option(argv, '--timeout-ms') ?? '30000';
  const timeoutMs = Number(timeoutRaw);
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1_000 || timeoutMs > 120_000) {
    process.stderr.write('--timeout-ms must be an integer between 1000 and 120000.\n');
    return 2;
  }
  const scan = await scanRenderedPage(url.href, resolve(reportDir, 'raw'), timeoutMs);
  const report = {
    schemaVersion: '1.0.0',
    url: scan.url,
    failOn,
    failed: hasFindingAtOrAbove(scan.findings, failOn),
    findingCount: scan.findings.length,
    bySeverity: scan.bySeverity,
    findings: scan.findings,
  };
  await mkdir(reportDir, { recursive: true });
  await writeFile(resolve(reportDir, 'stencil-ariada-url-report.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  process.stdout.write(`${JSON.stringify({ report: resolve(reportDir, 'stencil-ariada-url-report.json'), ...report })}\n`);
  return report.failed ? 1 : 0;
}

function option(argv: readonly string[], name: string): string | undefined {
  const index = argv.indexOf(name);
  if (index === -1)
    return undefined;
  const value = argv[index + 1];
  if (value === undefined || value.startsWith('--'))
    throw new Error(`${name} requires a value`);
  return value;
}

void runCli(process.argv.slice(2))
  .then((exitCode) => {
    process.exitCode = exitCode;
  })
  .catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
    process.exitCode = 3;
  });
