#!/usr/bin/env node
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../../..');
const source = resolve(root, 'packages/extension-chrome/.output/chrome-mv3');
const dist = resolve(import.meta.dirname, '../dist');
const packageDir = resolve(dist, 'firefox-mv3');
const zipPath = resolve(dist, 'ariada-firefox-addon.zip');
const manifestPath = resolve(packageDir, 'manifest.json');

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
await cp(source, packageDir, { recursive: true });

const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
manifest.browser_specific_settings = {
  gecko: {
    id: 'extension@ariada.org',
    strict_min_version: '128.0',
  },
};
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

const zip = spawnSync('zip', ['-qr', zipPath, '.'], { cwd: packageDir, stdio: 'inherit' });
if (zip.status !== 0) {
  process.exit(zip.status ?? 1);
}

console.log(`PASS wrote ${zipPath}`);
