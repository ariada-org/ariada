#!/usr/bin/env node
// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Bundles the extension's entrypoints with esbuild and assembles a loadable
// Manifest V3 directory under dist/. The output directory is what you point
// chrome://extensions "Load unpacked" (or Playwright --load-extension) at.

import { build } from 'esbuild';
import {
  cpSync,
  mkdirSync,
  rmSync,
  existsSync,
  writeFileSync,
  readFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const outDir = join(root, 'dist');
const srcEntry = join(root, 'src', 'entrypoints');
const publicDir = join(root, 'public');

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

const entryPoints = {
  background: join(srcEntry, 'background.ts'),
  content: join(srcEntry, 'content.ts'),
  sidepanel: join(srcEntry, 'sidepanel.ts'),
  settings: join(srcEntry, 'settings.ts'),
};

await build({
  entryPoints,
  outdir: outDir,
  bundle: true,
  format: 'esm',
  target: 'chrome114',
  platform: 'browser',
  sourcemap: false,
  minify: false,
  legalComments: 'none',
  logLevel: 'info',
});

// Copy the static manifest + HTML shells + icons into dist/.
cpSync(publicDir, outDir, { recursive: true });

// Generate placeholder PNG icons if none are committed, so the manifest loads.
const iconsDir = join(outDir, 'icons');
mkdirSync(iconsDir, { recursive: true });
// 1x1 transparent PNG (base64), sufficient for the manifest to load.
const PNG_1PX =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
for (const size of [16, 48, 128]) {
  const target = join(iconsDir, `icon-${size}.png`);
  if (!existsSync(target)) {
    writeFileSync(target, Buffer.from(PNG_1PX, 'base64'));
  }
}

// Sanity: confirm the manifest references files that now exist on disk.
const manifest = JSON.parse(readFileSync(join(outDir, 'manifest.json'), 'utf8'));
const expected = [
  'background.js',
  'sidepanel.html',
  'settings.html',
  manifest.icons['128'],
];
const missing = expected.filter((f) => !existsSync(join(outDir, f)));
if (missing.length > 0) {
  console.error(`[build] missing expected output files: ${missing.join(', ')}`);
  process.exit(1);
}

console.log(`[build] extension assembled at ${outDir}`);
