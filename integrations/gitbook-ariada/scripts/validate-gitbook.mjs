// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { access, readFile } from 'node:fs/promises';

const requiredFiles = [
  'README.md',
  'examples/github-actions.yml',
  'fixtures/export/index.html',
  'scripts/gitbook-ariada.mjs',
  'scan-evidence/result.html',
];

for (const file of requiredFiles) {
  await access(new URL(`../${file}`, import.meta.url));
}

const readme = await readFile(new URL('../README.md', import.meta.url), 'utf8');
for (const text of [
  'https://gitbook.com/docs/docs-site/publish-a-docs-site',
  'https://gitbook.com/docs/developers',
  '@ariada-org/cli',
  'no local GitBook build hook',
]) {
  if (!readme.includes(text)) {
    throw new Error(`README missing required GitBook integration note: ${text}`);
  }
}

console.log('GitBook Ariada integration shape OK.');
