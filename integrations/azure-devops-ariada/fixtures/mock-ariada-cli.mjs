#!/usr/bin/env node
// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const args = process.argv.slice(2);
if (args[0] !== 'scan' || !/^https?:\/\//.test(args[1] ?? '')) {
  console.error('mock ariada: expected scan <http-url>');
  process.exit(2);
}

const outputDir = resolve(args[args.indexOf('--output-dir') + 1] ?? './ariada-output');
await mkdir(outputDir, { recursive: true });
const scan = {
  $schema: 'https://ariada.org/schemas/cli-scan.v1.json',
  url: args[1],
  scanId: 'S32-AZURE-DEVOPS-FIXTURE',
  summary: { total: 0, byImpact: { critical: 0, serious: 0, moderate: 0, minor: 0 } },
  exitCode: 0,
};
await writeFile(resolve(outputDir, 'scan.json'), `${JSON.stringify(scan, null, 2)}\n`);
console.log(`mock ariada wrote ${resolve(outputDir, 'scan.json')}`);
