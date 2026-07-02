// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

const { copyFileSync, mkdirSync, readdirSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');

mkdirSync('dist-cjs', { recursive: true });
writeFileSync('dist-cjs/package.json', '{"type":"commonjs"}\n', 'utf8');

for (const name of readdirSync('dist')) {
  if (name.endsWith('.d.ts')) {
    copyFileSync(join('dist', name), join('dist-cjs', name.replace(/\.d\.ts$/, '.d.cts')));
  }
}
