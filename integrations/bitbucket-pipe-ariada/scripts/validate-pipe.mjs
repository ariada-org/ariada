// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { readFile } from 'node:fs/promises';

const pipe = await readFile(new URL('../pipe.yml', import.meta.url), 'utf8');
for (const required of ['name:', 'image:', 'variables:', 'TARGET_URL', 'FAIL_ON_SEVERITY']) {
  if (!pipe.includes(required)) {
    throw new Error(`pipe.yml missing ${required}`);
  }
}

console.log('Bitbucket Pipe metadata shape OK: name, image, and variables present.');
