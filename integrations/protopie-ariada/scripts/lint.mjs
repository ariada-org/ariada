#!/usr/bin/env node
// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const roots = ['src', 'tests', 'scripts'];
const errors = [];

for (const root of roots) await visit(root);

if (errors.length > 0) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log('lint ok');

async function visit(dir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!['node_modules', 'dist', 'coverage'].includes(entry.name)) await visit(full);
    } else if (/\.(?:ts|mjs|js)$/u.test(entry.name)) {
      const body = await readFile(full, 'utf8');
      if (/\t/u.test(body)) errors.push(`${full}: tabs are not allowed`);
      if (/[ \t]$/mu.test(body)) errors.push(`${full}: trailing whitespace`);
      if (!body.startsWith('// SPDX-FileCopyrightText') && !body.startsWith('#!/usr/bin/env node\n// SPDX-FileCopyrightText')) {
        errors.push(`${full}: missing SPDX header`);
      }
    }
  }
}
