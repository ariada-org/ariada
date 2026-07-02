#!/usr/bin/env node
// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { scanPenpotExport } from '../dist/scanner.js';

const root = resolve(import.meta.dirname, '..');
const repoRoot = resolve(root, '../..');
const outputDir = resolve(root, 'scan-evidence');
const shapes = JSON.parse(await readFile(resolve(root, 'fixtures/penpot-selection.json'), 'utf8'));

await mkdir(outputDir, { recursive: true });
const result = await scanPenpotExport({
  shapes,
  outputDir,
  cliPath: resolve(repoRoot, 'packages/ariada-cli/dist/bin.js'),
  severityThreshold: 'serious',
});

await writeFile(
  resolve(outputDir, 'command.log'),
  normalizeLog(`${result.command}\n\nSTDOUT\n${result.stdout}\nSTDERR\n${result.stderr}`),
  'utf8',
);
await writeFile(resolve(outputDir, 'command.exit'), `${result.exitCode}\n`, 'utf8');
await writeFile(resolve(outputDir, 'design-checks.json'), `${JSON.stringify(result.surface.checks, null, 2)}\n`, 'utf8');

const rawJsonPath = resolve(outputDir, 'ariada-output/multi-domain-report.json');
const runtimeFailure = /ERR_MODULE_NOT_FOUND|E_NAVIGATION_FAILED|E_NAVIGATION_TIMEOUT|TypeError|ReferenceError/i.test(
  `${result.stdout}\n${result.stderr}`,
);

if (result.exitCode > 1 || runtimeFailure) {
  console.error(result.stderr || result.stdout);
  process.exit(result.exitCode);
}

try {
  await readFile(rawJsonPath, 'utf8');
} catch {
  console.error(`Missing Ariada raw JSON: ${rawJsonPath}`);
  process.exit(3);
}

console.log(`Ariada CLI fixture scan complete with exit ${result.exitCode}`);

function normalizeLog(value) {
  return `${value
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .trimEnd()}\n`;
}
