#!/usr/bin/env node
// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import {
  buildAriadaScanCommand,
  invokeAriadaCli,
  renderXdSelectionHtml,
  serveDirectory,
} from '../src/adapter.mjs';

const args = process.argv.slice(2);
const fixturePath = resolve(readArg('--fixture') || 'fixtures/xd-selection.json');
const evidenceDir = resolve(readArg('--out') || 'scan-evidence');
const exportDir = resolve(evidenceDir, 'export');
const outputDir = resolve(evidenceDir, 'ariada-output');
const logPath = resolve(evidenceDir, 'command.log');
const exitPath = resolve(evidenceDir, 'command.exit');
const root = resolve(import.meta.dirname, '../../..');
const cliPath = resolve(root, 'packages/ariada-cli/dist/bin.js');

await mkdir(exportDir, { recursive: true });
await mkdir(outputDir, { recursive: true });
const selection = JSON.parse(await readFile(fixturePath, 'utf8'));
await writeFile(resolve(exportDir, 'index.html'), renderXdSelectionHtml(selection), 'utf8');

let command = [];
let result = { status: 3, stdout: '', stderr: `Missing built CLI at ${cliPath}\n` };
let url = '';

if (existsSync(cliPath)) {
  const served = await serveDirectory(exportDir);
  url = served.url;
  command = buildAriadaScanCommand({ cliPath, outputDir, url });
  result = await invokeAriadaCli(command, { cwd: root });
  await new Promise((resolveClose) => served.server.close(resolveClose));
}

const printableCommand = command.length > 0
  ? [
      'node',
      'packages/ariada-cli/dist/bin.js',
      'scan',
      url,
      '--format',
      'both',
      '--output-dir',
      'integrations/xd-ariada/scan-evidence/ariada-output',
      '--severity-threshold',
      'minor',
      '--browser',
      'chromium',
    ].join(' ')
  : 'node packages/ariada-cli/dist/bin.js scan <local-export-url> --format both --output-dir integrations/xd-ariada/scan-evidence/ariada-output';

const log = [
  'cwd: <worktree>',
  'fixture: integrations/xd-ariada/fixtures/xd-selection.json',
  'export: integrations/xd-ariada/scan-evidence/export/index.html',
  `command: ${printableCommand}`,
  `url: ${url || '(not served; CLI missing)'}`,
  '',
  '# stdout',
  redactPaths(result.stdout || '(empty)', root),
  '',
  '# stderr',
  redactPaths(result.stderr || '(empty)', root),
].join('\n');

await writeFile(logPath, `${log}\n`, 'utf8');
await writeFile(exitPath, `${result.status}\n`, 'utf8');
console.log(`scan-export exit ${result.status}; log ${logPath}`);

function readArg(name) {
  const index = args.indexOf(name);
  if (index === -1) return '';
  return args[index + 1] || '';
}

function redactPaths(value, workspaceRoot) {
  return value
    .replaceAll(workspaceRoot, '<worktree>')
    .replaceAll(process.env.HOME || '', '<home>')
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n');
}
