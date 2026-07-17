#!/usr/bin/env node
// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const html = readFileSync(join(root, 'test/fixtures/phoenix_static_output/index.html'), 'utf8');
const evidence = JSON.parse(
  readFileSync(join(root, 'scan-evidence/ariada-output/multi-domain-report.json'), 'utf8'),
);

const failures = [];
if (!html.includes('<main>')) failures.push('fixture missing main landmark');
if (!html.includes('<form')) failures.push('fixture missing Phoenix-style form surface');
if (!html.includes('<img src=') || /<img[^>]+alt=/i.test(html)) {
  failures.push('fixture must include an image-alt defect');
}
if (!html.includes('placeholder="Permit number"')) failures.push('fixture missing unlabeled input defect');
if (evidence.summary.totalViolations !== 3) failures.push('expected 3 fixture violations');
if (evidence.adapter !== 'ariada_phoenix') failures.push('wrong evidence adapter id');

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log('fixture ok: Phoenix static output and Ariada evidence JSON are coherent');
