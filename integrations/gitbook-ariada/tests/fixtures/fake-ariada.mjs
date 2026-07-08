#!/usr/bin/env node
// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const args = process.argv.slice(2);
const target = args[0] === 'scan' ? args[1] : undefined;
const outputDirIndex = args.indexOf('--output-dir');
const outputDir = outputDirIndex === -1 ? 'ariada-output' : args[outputDirIndex + 1];

if (!target) {
  console.error('fake ariada: expected scan <url>');
  process.exit(2);
}

const html = await fetch(target).then((response) => response.text());
const missingAlt = /<img(?![^>]*\salt=)[^>]*>/i.test(html);
const findings = missingAlt
  ? [
      {
        ruleId: 'image-alt',
        severity: 'serious',
        message: 'GitBook export fixture image is missing alt text.',
        path: 'index.html',
      },
    ]
  : [];

await mkdir(outputDir, { recursive: true });
await writeFile(
  resolve(outputDir, 'scan.json'),
  `${JSON.stringify(
    {
      url: target,
      scanId: 'gitbook-fixture',
      report: {
        findings,
      },
      exitCode: findings.length > 0 ? 1 : 0,
    },
    null,
    2,
  )}\n`,
  'utf8',
);
console.log(`fake ariada: wrote ${findings.length} finding(s)`);
process.exit(findings.length > 0 ? 1 : 0);
