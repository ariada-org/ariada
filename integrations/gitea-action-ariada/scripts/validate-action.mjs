// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { readFile } from 'node:fs/promises';

const action = await readFile(new URL('../action.yml', import.meta.url), 'utf8');
for (const required of ['name:', 'runs:', 'inputs:', 'target-url:', 'using: composite']) {
  if (!action.includes(required)) {
    throw new Error(`action.yml missing ${required}`);
  }
}

console.log('Gitea Action metadata shape OK: name, runs, inputs, and target-url present.');
