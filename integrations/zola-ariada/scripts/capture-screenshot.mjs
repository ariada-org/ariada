#!/usr/bin/env node
// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

import { existsSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd().endsWith('zola-ariada')
  ? process.cwd()
  : join(process.cwd(), 'integrations', 'zola-ariada');
const preview = join(root, 'scan-evidence', 'scan-result-preview.html');
const output = join(root, 'scan-evidence', 'screenshots', 'scan-result.png');
const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

mkdirSync(join(root, 'scan-evidence', 'screenshots'), { recursive: true });

if (!existsSync(preview)) {
  throw new Error(`Missing preview HTML: ${preview}. Run node scripts/build-evidence.mjs first.`);
}
if (!existsSync(chrome)) {
  throw new Error(`Missing Chrome executable: ${chrome}`);
}

const result = spawnSync(
  chrome,
  [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--window-size=1280,520',
    `--screenshot=${resolve(output)}`,
    pathToFileURL(preview).href,
  ],
  { stdio: 'inherit' },
);

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

process.stdout.write(`${output}\n`);
