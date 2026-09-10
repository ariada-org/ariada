#!/usr/bin/env node
// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Recovered from `dist/bin.js` and `dist/bin.d.ts`. The source this was built
// from was never committed; the compiled output is `tsc` with the types
// stripped, so the shapes come back from the declaration file and the bodies are
// the compiled ones. Checked with
// the rebuild check.
//
// EVERY SETTING CAN COME FROM A FILE OR FROM THE COMMAND LINE, and the command
// line wins. That order is the useful one: the file holds what is true for the
// site, and the command line holds what is true for this run.
//
// THE THRESHOLD IS CHECKED BEFORE ANYTHING IS RUN. A misspelled severity would
// otherwise start a browser, scan a site and only then be refused — expensive,
// and by then the person has walked away.
//
// The exit code separates a page that did not pass from a command that could not
// reach a verdict: one for the first, two for the second. Merging them makes a
// typo look like an inaccessible site.

import { readFile } from 'node:fs/promises';

import { evaluateGate, scanTypedreamSite, SEVERITIES, type Severity } from './index.js';

const args = process.argv.slice(2);
const value = (name: string): string | undefined => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};

const configPath = value('--config');
const config = configPath ? JSON.parse(await readFile(configPath, 'utf8')) : {};
const publishedUrl = value('--url') ?? String(config['publishedUrl'] ?? '');
const threshold = (value('--severity-threshold') ??
  String(config['severityThreshold'] ?? 'serious')) as Severity;
const cli = value('--cli') ?? (typeof config['cliBin'] === 'string' ? config['cliBin'] : undefined);

if (args[0] !== 'scan' || !publishedUrl) {
  console.error(
    'Usage: typedream-ariada scan --url <published-url> [--output-dir dir] [--severity-threshold severity] [--config file]',
  );
  process.exit(2);
}

if (!SEVERITIES.includes(threshold)) {
  console.error(`Unsupported severity threshold: ${threshold}`);
  process.exit(2);
}

try {
  const result = await scanTypedreamSite({
    publishedUrl,
    severityThreshold: threshold,
    outputDirectory: value('--output-dir') ?? String(config['outputDirectory'] ?? 'ariada-output'),
    ...(cli ? { cliBin: cli } : {}),
    ...(value('--timeout-ms') ? { timeoutMs: Number(value('--timeout-ms')) } : {}),
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  process.exit(evaluateGate(result));
} catch (error) {
  console.error(`typedream-ariada: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(2);
}
