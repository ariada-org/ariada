// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Recovered from `dist/cli.js`. Checked with
// `bash scripts/sverit-vosstanovlennoe.sh`.

import { readFile } from 'node:fs/promises';

import { scanGlidePublishedApp, type GlideScanConfig, type Severity } from './adapter.js';

const args = process.argv.slice(2);
const value = (name: string): string | undefined => {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
};
const configPath = value('--config');
const config: GlideScanConfig = configPath
  ? (JSON.parse(await readFile(configPath, 'utf8')) as GlideScanConfig)
  : {
      targetUrl: value('--url') ?? process.env['GLIDE_PUBLISHED_URL'] ?? '',
      reportDir: value('--report-dir') ?? 'ariada-output/glide',
      severityThreshold: (value('--severity-threshold') ?? 'serious') as Severity,
      timeoutMs: Number(value('--timeout-ms') ?? '30000'),
      cli: value('--cli') as string,
    };
if (!config.targetUrl) {
  console.error(
    'Usage: glide-ariada --url <published-glide-url> [--report-dir <dir>] [--config <file>]',
  );
  process.exit(2);
}
const boundary = {
  appName: value('--app-name') ?? 'Glide app',
  pageName: value('--page-name') ?? 'Published page',
  publishedUrl: config.targetUrl,
};
try {
  const result = await scanGlidePublishedApp(boundary, {
    ...config,
    targetUrl: undefined,
  } as unknown as Omit<GlideScanConfig, 'targetUrl'>);
  console.log(
    `Glide Ariada: ${result.boundary.appName} / ${result.boundary.pageName} (${result.findings.length} finding(s), threshold ${result.threshold})`,
  );
  for (const finding of result.findings.slice(0, 10))
    console.log(`- ${finding.ruleId} [${finding.severity}] ${finding.message}`);
  process.exitCode = result.failed ? 1 : 0;
} catch (error) {
  console.error(`Glide Ariada: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 2;
}
