#!/usr/bin/env node
// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { loadConfig, runProtoPieScan, summarizeStaticSurface } from '../dist/index.js';

const config = await loadConfig('protopie-ariada.config.json');
await mkdir(resolve('scan-evidence/ariada-output'), { recursive: true });

const result = await runProtoPieScan(config, {
  cliCommand: process.env['ARIADA_CLI'] ?? 'ariada',
});

await writeFile('scan-evidence/command.exit', `${result.exitCode}\n`, 'utf8');
await writeFile(
  'scan-evidence/command.log',
  [
    `$ ${result.commandLine}`,
    `target: ${result.targetUrl}`,
    result.servedHostDir ? `servedHostDir: ${result.servedHostDir}` : '',
    result.bundle ? `protoPieBundle: ${result.bundle.dir}` : '',
    result.bundle ? `staticSurface: ${summarizeStaticSurface(result.bundle).join(' | ')}` : '',
    `exit: ${result.exitCode}`,
    '',
    'stdout:',
    result.stdout,
    '',
    'stderr:',
    result.stderr,
  ].filter(Boolean).join('\n'),
  'utf8',
);

process.stdout.write(result.stdout);
process.stderr.write(result.stderr);
process.exitCode = result.exitCode;
