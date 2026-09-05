// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Recovered from `dist/bin.js`. Checked with
// `bash scripts/sverit-vosstanovlennoe.sh`.

import { readFile } from 'node:fs/promises';

import { evaluateGate, scanSoftr, SEVERITIES, type Severity } from './index.js';

const args = process.argv.slice(2);
const value = (name: string): string | undefined => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};
const configPath = value('--config');
const config = configPath
  ? ((JSON.parse(await readFile(configPath, 'utf8')) as Record<string, unknown>))
  : ({} as Record<string, unknown>);
const targetUrl = value('--url') ?? (config['targetUrl'] as string | undefined);
const threshold = (value('--severity-threshold') ??
  config['severityThreshold'] ??
  'serious') as Severity;
if (!targetUrl) {
  console.error(
    'Usage: softr-ariada scan --url <authenticated-or-published-url> [--output-dir dir]',
  );
  process.exit(2);
}
if (!SEVERITIES.includes(threshold)) {
  console.error(`Unsupported severity threshold: ${threshold}`);
  process.exit(2);
}
try {
  const result = await scanSoftr({
    targetUrl,
    severityThreshold: threshold,
    outputDirectory: (value('--output-dir') ?? config['outputDirectory']) as string,
    cliBin: (value('--cli') ?? config['cliBin']) as string,
  });
  console.log(JSON.stringify(result, null, 2));
  process.exit(evaluateGate(result));
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(2);
}
