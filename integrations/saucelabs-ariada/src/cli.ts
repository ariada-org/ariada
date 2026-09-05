#!/usr/bin/env node
// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Recovered from `dist/cli.js`. Checked with
// `bash scripts/sverit-vosstanovlennoe.sh`.

import { readFile } from 'node:fs/promises';

import { parseSauceManifest } from './manifest.js';

if (process.argv.includes('--help')) {
  console.log('saucelabs-ariada --manifest <path>');
  console.log(
    'Loads and validates a typed Sauce Labs manifest. Session creation is injected by the host runner.',
  );
  process.exit(0);
}
const index = process.argv.indexOf('--manifest');
if (index === -1 || !process.argv[index + 1]) {
  console.error('Missing --manifest <path>');
  process.exit(2);
}
const input = JSON.parse(await readFile(process.argv[index + 1] as string, 'utf8'));
const manifest = parseSauceManifest(input);
console.log(JSON.stringify({ valid: true, runId: manifest.runId, source: manifest.source.url }));
