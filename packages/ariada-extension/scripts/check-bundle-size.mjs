#!/usr/bin/env node
// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Verify that the bundled extension outputs stay within the size limits that
// keep the side panel snappy and the background service worker lean. Sizes are
// checked after gzip compression (which Chrome uses for extension package
// distribution) rather than raw file size. Run after `pnpm build`.

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const distDir = join(root, 'dist');

// Size limits in bytes (gzip-compressed)
const LIMITS = {
  'sidepanel.js': 300 * 1024,  // 300 KB — the main UI bundle
  'content.js': 250 * 1024,    // 250 KB — the content script
  'background.js': 50 * 1024,  // 50 KB  — the service worker (must be lean)
};

let failed = false;

for (const [filename, limitBytes] of Object.entries(LIMITS)) {
  const filePath = join(distDir, filename);

  if (!existsSync(filePath)) {
    console.error(`[size] MISSING: ${filename} (run pnpm build first)`);
    failed = true;
    continue;
  }

  const raw = readFileSync(filePath);
  const compressed = gzipSync(raw);
  const kb = (compressed.byteLength / 1024).toFixed(1);
  const limitKb = (limitBytes / 1024).toFixed(0);

  if (compressed.byteLength > limitBytes) {
    console.error(`[size] FAIL: ${filename} is ${kb} KB gzip (limit: ${limitKb} KB)`);
    failed = true;
  } else {
    console.log(`[size] OK: ${filename} is ${kb} KB gzip (limit: ${limitKb} KB)`);
  }
}

if (failed) {
  process.exit(1);
}
