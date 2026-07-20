#!/usr/bin/env node
// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const manifest = JSON.parse(readFileSync(resolve(root, 'jsr.json'), 'utf8'));
const denoConfig = JSON.parse(readFileSync(resolve(root, 'deno.json'), 'utf8'));

const failures = [];
if (manifest.name !== '@ariada-org/ariada-jsr') failures.push('jsr.json name mismatch');
if (!/^\d+\.\d+\.\d+$/.test(manifest.version)) failures.push('jsr.json version must be semver');
if (manifest.exports?.['.'] !== './src/mod.ts') failures.push('jsr.json must export ./src/mod.ts');
if (denoConfig.imports?.['@ariada-org/ariada-jsr'] !== './src/mod.ts') {
  failures.push('deno.json import map must point package name at ./src/mod.ts');
}
if (!manifest.publish?.include?.includes('README.md')) {
  failures.push('jsr.json publish.include must include README.md');
}

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log('JSR manifest shape OK');
