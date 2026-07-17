// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { readFile } from 'node:fs/promises';

const manifest = JSON.parse(await readFile(new URL('../vercel-integration.json', import.meta.url), 'utf8'));
for (const key of ['name', 'slug', 'version', 'events', 'permissions']) {
  if (!(key in manifest)) {
    throw new Error(`vercel-integration.json missing ${key}`);
  }
}
if (!manifest.events.includes('deployment.ready')) {
  throw new Error('Vercel integration must subscribe to deployment.ready');
}
if (!manifest.permissions.includes('checks:write')) {
  throw new Error('Vercel integration must declare checks:write');
}

console.log('Vercel integration shape OK: deployment.ready + checks:write configured.');
