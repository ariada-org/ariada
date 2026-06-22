// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { readFile } from 'node:fs/promises';

const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
if (pkg.backstage?.role !== 'frontend-plugin') {
  throw new Error('package.json must declare backstage.role=frontend-plugin');
}
for (const dep of ['@backstage/core-plugin-api', '@backstage/plugin-catalog-react', 'react']) {
  if (!(dep in pkg.peerDependencies)) {
    throw new Error(`package.json peerDependencies missing ${dep}`);
  }
}

console.log('Backstage package shape OK: frontend-plugin role and peers present.');
