#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const template = await readFile(resolve(import.meta.dirname, '../gitpod-template.yml'), 'utf8');
const failures = [];
if (!template.includes('tasks:')) failures.push('missing tasks');
if (!template.includes('pnpm install --frozen-lockfile')) failures.push('missing frozen install task');
if (!template.includes('run-ariada.mjs')) failures.push('missing Ariada scan task');

if (failures.length > 0) {
  console.error(`Gitpod template validation failed:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log('PASS Gitpod template includes install and Ariada scan tasks');
