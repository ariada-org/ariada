// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { readFile } from 'node:fs/promises';

const manifest = await readFile(new URL('../.pre-commit-hooks.yaml', import.meta.url), 'utf8');
for (const required of ['id: ariada-accessibility', 'name:', 'entry:', 'language:', 'files:']) {
  if (!manifest.includes(required)) {
    throw new Error(`pre-commit hook manifest missing ${required}`);
  }
}

console.log('pre-commit hook manifest shape OK: id, name, entry, language, files present.');
