// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';

const text = readFileSync(new URL('../tasks/ariada.js', import.meta.url), 'utf8');
const forbidden = [/\bdebugger\b/, /\bconsole\.log\s*\(/];
for (const pattern of forbidden) {
  if (pattern.test(text)) {
    process.stderr.write(`Forbidden debug pattern: ${pattern}\n`);
    process.exit(1);
  }
}
