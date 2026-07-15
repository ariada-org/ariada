#!/usr/bin/env node
// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const required = [
  'composer.json',
  'config/ariada.php',
  'src/AriadaCliRunner.php',
  'src/AriadaScanner.php',
  'src/ScanResult.php',
  'src/Contracts/CliRunner.php',
  'src/Laravel/AriadaServiceProvider.php',
  'src/Laravel/ScanCommand.php',
  'tests/Unit/AriadaScannerTest.php',
  'tests/Unit/ScanResultTest.php',
  'tests/Feature/ScanCommandTest.php',
  'fixtures/laravel-dashboard.html',
];

const missing = required.filter((file) => !existsSync(join(root, file)));
if (missing.length > 0) {
  console.error(`Missing required files:\n${missing.map((file) => `- ${file}`).join('\n')}`);
  process.exit(1);
}

const composer = JSON.parse(readFileSync(join(root, 'composer.json'), 'utf8'));
if (composer.name !== 'ariada/laravel-accessibility') {
  console.error(`Unexpected Composer package name: ${composer.name}`);
  process.exit(1);
}

const provider = composer.extra?.laravel?.providers?.[0];
if (provider !== 'Ariada\\LaravelAccessibility\\Laravel\\AriadaServiceProvider') {
  console.error('Laravel auto-discovery provider is not configured.');
  process.exit(1);
}

const command = readFileSync(join(root, 'src/Laravel/ScanCommand.php'), 'utf8');
if (!command.includes('ariada:scan') || !command.includes('AriadaScanner')) {
  console.error('Artisan command does not expose ariada:scan through AriadaScanner.');
  process.exit(1);
}

console.log('S98 PHP/Laravel structure check passed.');
