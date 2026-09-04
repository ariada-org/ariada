#!/usr/bin/env node
// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Recovered from `dist/cli.js`. Checked with
// `bash scripts/sverit-vosstanovlennoe.sh`.

import { scanCarrdSite, type Severity } from './index.js';

const url = process.argv[2];
const threshold = (process.argv
  .find((arg) => arg.startsWith('--severity-threshold='))
  ?.split('=')[1] ?? 'moderate') as Severity;
if (!url) {
  console.error(
    'Usage: carrd-ariada <published-url> [--severity-threshold=<minor|moderate|serious|critical>]',
  );
  process.exit(2);
}
try {
  const scan = await scanCarrdSite(url, { threshold });
  console.log(JSON.stringify(scan, null, 2));
  process.exit(scan.gate.exitCode);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(2);
}
