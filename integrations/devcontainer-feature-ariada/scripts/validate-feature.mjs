// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { readFile } from 'node:fs/promises';

const feature = JSON.parse(await readFile(new URL('../src/ariada/devcontainer-feature.json', import.meta.url), 'utf8'));
const requiredStrings = ['id', 'version', 'name', 'options'];
for (const key of requiredStrings) {
  if (!(key in feature)) {
    throw new Error(`devcontainer-feature.json missing ${key}`);
  }
}
if (feature.id !== 'ariada') {
  throw new Error('Feature id must be ariada');
}
if (feature.options?.installPlaywright?.type !== 'boolean') {
  throw new Error('installPlaywright option must be boolean');
}

console.log('Devcontainer Feature shape OK: id, version, name, and options present.');
