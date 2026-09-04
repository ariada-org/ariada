// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Recovered from `dist/cli.js`. Checked with
// `bash scripts/sverit-vosstanovlennoe.sh`.

import { readFile } from 'node:fs/promises';

import { toScanCompletedBundle, toViolationBundles } from './mapper.js';
import type { AriadaReport } from './types.js';

const args = process.argv.slice(2);
const eventIndex = args.indexOf('--event');
const event = eventIndex >= 0 ? args[eventIndex + 1] : 'violations';
const reportPath = args[args.indexOf('--report') + 1] ?? '-';
if (!['violations', 'completed'].includes(event as string))
  throw new Error('--event must be violations or completed');
const source = reportPath === '-' ? await readStdin() : await readFile(reportPath, 'utf8');
const report = JSON.parse(source) as AriadaReport;
const output = event === 'completed' ? toScanCompletedBundle(report) : toViolationBundles(report);
process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);

/**
 * The whole of standard input.
 *
 * @returns what was piped in
 */
function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let source = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => {
      source += chunk;
    });
    process.stdin.on('end', () => resolve(source));
    process.stdin.on('error', reject);
  });
}
