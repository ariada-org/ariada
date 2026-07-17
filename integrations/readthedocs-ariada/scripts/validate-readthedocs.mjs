// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { readFile } from 'node:fs/promises';

const yaml = await readFile(new URL('../examples/.readthedocs.yaml', import.meta.url), 'utf8');
for (const required of ['version: 2', 'build:', 'jobs:', 'post_build:', './scripts/post-build.sh']) {
  if (!yaml.includes(required)) {
    throw new Error(`Read the Docs example missing ${required}`);
  }
}

console.log('Read the Docs config shape OK: v2 build.jobs.post_build present.');
