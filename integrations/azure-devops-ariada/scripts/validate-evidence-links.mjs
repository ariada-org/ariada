// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { access, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const htmlFiles = [resolve(root, 'test-report/result.html'), resolve(root, 'scan-evidence/result.html')];
const missing = [];

for (const file of htmlFiles) {
  const html = await readFile(file, 'utf8');
  for (const match of html.matchAll(/\b(?:href|src)="([^"]+)"/g)) {
    const value = match[1];
    if (/^(https?:|mailto:|#)/.test(value)) continue;
    const target = value.startsWith('file://') ? fileURLToPath(value) : resolve(dirname(file), value);
    try {
      await access(target);
    } catch {
      missing.push(`${file} -> ${value}`);
    }
  }
}

const screenshot = resolve(root, 'test-report/screenshot.png');
// Read once, and everything said below is said about those bytes. Asking for
// the size and then reading is judging two different states of the file: it can
// change between the two calls, and then the size check is about one content and
// the header check about another.
const png = await readFile(screenshot).catch(() => null);
if (!png || png.length < 10_000) missing.push('test-report/screenshot.png missing or too small');
if (png && png.length > 8 && png.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') {
  missing.push('test-report/screenshot.png is not a PNG');
}

if (missing.length) {
  console.error(missing.join('\n'));
  process.exit(1);
}
console.log('Evidence links and screenshot OK.');
