// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { readFile } from 'node:fs/promises';

const config = JSON.parse(await readFile(new URL('../jsr.json', import.meta.url), 'utf8'));
for (const key of ['name', 'version', 'exports']) {
  if (!(key in config)) {
    throw new Error(`jsr.json missing ${key}`);
  }
}
if (!config.name.startsWith('@ariada-org/')) {
  throw new Error('JSR package must use the @ariada-org scope');
}

console.log('JSR config shape OK: name, version, exports present.');
