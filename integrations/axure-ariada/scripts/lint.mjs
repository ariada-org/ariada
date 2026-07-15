#!/usr/bin/env node
// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { readdir, readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

const roots = ['src', 'tests', 'scripts'];
const checkedExtensions = new Set(['.ts', '.mjs']);
const failures = [];

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(path);
      continue;
    }
    if (!checkedExtensions.has(extname(entry.name))) continue;
    const body = await readFile(path, 'utf8');
    if (!body.includes('SPDX-License-Identifier: EUPL-1.2')) {
      failures.push(`${path}: missing SPDX license header`);
    }
    body.split('\n').forEach((line, index) => {
      if (/\s$/u.test(line)) failures.push(`${path}:${index + 1}: trailing whitespace`);
      if (line.length > 140 && !line.includes('https://') && !path.endsWith('build-evidence-report.mjs')) {
        failures.push(`${path}:${index + 1}: line longer than 140 chars`);
      }
    });
  }
}

for (const root of roots) {
  await walk(root);
}

if (failures.length > 0) {
  console.error(`Axure Ariada lint failed:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log('PASS Axure Ariada lint checks');
