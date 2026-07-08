// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
'use strict';

const { readdirSync, readFileSync } = require('node:fs');
const { join } = require('node:path');

const root = join(__dirname, '..');
const failures = [];
const debuggerPattern = new RegExp('\\bdebug' + 'ger\\b');
const consoleLogPattern = new RegExp('\\bconsole\\.' + 'log\\b');

for (const file of listJs(root)) {
  const rel = file.slice(root.length + 1);
  if (rel.startsWith('scan-evidence/')) continue;
  const source = readFileSync(file, 'utf8');
  if (debuggerPattern.test(source)) failures.push(`${rel}: debug statement`);
  if (consoleLogPattern.test(source)) failures.push(`${rel}: console logging`);
}

if (failures.length > 0) {
  process.stderr.write(`${failures.join('\n')}\n`);
  process.exit(1);
}

function listJs(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listJs(path));
    if (entry.isFile() && entry.name.endsWith('.js')) out.push(path);
  }
  return out;
}
