#!/usr/bin/env node
// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Recovered from `dist/cli.js` and `dist/cli.d.ts`. The source this was built
// from was never committed; the compiled output is `tsc` with the types
// stripped, so the shapes come back from the declaration file and the bodies are
// the compiled ones. Checked with
// the rebuild check.
//
// TWO EXIT CODES MEAN DIFFERENT THINGS AND ARE KEPT APART. One says the
// storefront has accessibility findings — a verdict about the page. Two says
// this command could not reach a verdict: no configuration named, a file that
// does not parse, a scanner that would not run. A build that treats both as
// failure sends whoever reads it to look at the storefront when the problem is
// the setup.
//
// The result is printed as the whole record rather than as a summary, because
// what comes next with it — a comment on a request, a gate, a report — is not
// this command's business, and a summary is the one shape that cannot be
// widened later.

import { readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';

import { scanSwellStorefront } from './index.js';

const { values } = parseArgs({
  options: { config: { type: 'string' }, 'cli-bin': { type: 'string' } },
});

if (values.config === undefined) {
  console.error('Usage: swell-ariada --config swell-ariada.config.json');
  process.exit(2);
}

try {
  const config = JSON.parse(await readFile(values.config, 'utf8'));
  const result = await scanSwellStorefront(
    config,
    typeof values['cli-bin'] === 'string' ? { cliBinary: values['cli-bin'] } : {},
  );
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.status === 'failed' ? 1 : 0;
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 2;
}
