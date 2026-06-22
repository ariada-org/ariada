#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const dir = resolve(import.meta.dirname, '../templates');
const packageTemplate = JSON.parse(await readFile(resolve(dir, 'package.template.json'), 'utf8'));
const sandbox = JSON.parse(await readFile(resolve(dir, 'sandbox.config.json'), 'utf8'));
const stackblitz = JSON.parse(await readFile(resolve(dir, 'stackblitzrc.json'), 'utf8'));

const failures = [];
if (!packageTemplate.scripts?.['ariada:scan']) failures.push('package template missing ariada:scan');
if (!packageTemplate.devDependencies?.['@ariada-org/cli']) failures.push('package template missing CLI dependency');
if (sandbox.container?.port !== 5173) failures.push('CodeSandbox template must expose Vite port 5173');
if (stackblitz.env?.ARIADA_SCAN_TARGET !== 'http://localhost:5173') failures.push('StackBlitz target must point at local preview');

if (failures.length > 0) {
  console.error(`Web IDE template validation failed:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log('PASS Web IDE templates include Ariada scan task and preview target');
