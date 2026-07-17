#!/usr/bin/env node
import { cp, mkdir, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../../..');
const source = resolve(root, 'packages/extension-chrome/.output/chrome-mv3');
const dist = resolve(import.meta.dirname, '../dist');
const packageDir = resolve(dist, 'edge-mv3');
const zipPath = resolve(dist, 'ariada-edge-addon.zip');

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
await cp(source, packageDir, { recursive: true });

const zip = spawnSync('zip', ['-qr', zipPath, '.'], { cwd: packageDir, stdio: 'inherit' });
if (zip.status !== 0) {
  process.exit(zip.status ?? 1);
}

console.log(`PASS wrote ${zipPath}`);

