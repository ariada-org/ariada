// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { loadConfig, runUxpinScan, type UxpinAriadaConfig } from './index.js';

interface ParsedArgs {
  configPath?: string;
  overrides: UxpinAriadaConfig;
  help: boolean;
}

function parseArgs(argv: string[]): ParsedArgs {
  const parsed: ParsedArgs = { overrides: {}, help: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => {
      const value = argv[++i];
      if (!value) throw new Error(`Missing value for ${arg}`);
      return value;
    };
    switch (arg) {
      case '--help':
      case '-h':
        parsed.help = true;
        break;
      case '--config':
        parsed.configPath = next();
        break;
      case '--export-dir':
        parsed.overrides.exportDir = next();
        break;
      case '--target-url':
        parsed.overrides.targetUrl = next();
        break;
      case '--output-dir':
        parsed.overrides.outputDir = next();
        break;
      case '--browser':
        parsed.overrides.browser = next() as UxpinAriadaConfig['browser'];
        break;
      case '--format':
        parsed.overrides.format = next() as UxpinAriadaConfig['format'];
        break;
      case '--severity-threshold':
        parsed.overrides.severityThreshold = next() as UxpinAriadaConfig['severityThreshold'];
        break;
      case '--timeout-ms':
        parsed.overrides.timeoutMs = Number.parseInt(next(), 10);
        break;
      case '--domains':
        parsed.overrides.domains = next().split(',').map((domain) => domain.trim()).filter(Boolean);
        break;
      case '--entry-file':
        parsed.overrides.entryFile = next();
        break;
      default:
        throw new Error(`Unknown option: ${arg}`);
    }
  }
  return parsed;
}

function help(): string {
  return `uxpin-ariada

Usage:
  uxpin-ariada --export-dir ./dist/uxpin-html --output-dir ./scan-evidence/ariada-output
  uxpin-ariada --target-url https://preview.uxpin.com/example --domains accessibility,security

Options:
  --config <path>              JSON recipe config. Defaults to ./uxpin-ariada.config.json when present.
  --export-dir <path>          Local UXPin HTML export folder.
  --target-url <url>           Hosted UXPin preview URL; skips local static serving.
  --output-dir <path>          Ariada machine-readable output directory.
  --domains <list>             Comma-separated Ariada domains to scan.
  --browser <name>             chromium | firefox | webkit.
  --format <name>              human | json | both.
  --severity-threshold <level> minor | moderate | serious | critical.
  --timeout-ms <ms>            Browser navigation timeout.
  --entry-file <path>          Entry HTML file inside the UXPin export.
`;
}

async function main(): Promise<number> {
  const parsed = parseArgs(process.argv.slice(2));
  if (parsed.help) {
    process.stdout.write(help());
    return 0;
  }

  let config: UxpinAriadaConfig = {};
  const configPath = parsed.configPath ?? 'uxpin-ariada.config.json';
  try {
    config = await loadConfig(configPath);
  } catch (err) {
    if (parsed.configPath) throw err;
  }
  config = { ...config, ...parsed.overrides };

  const result = await runUxpinScan(config);
  const logPath = resolve(config.outputDir ?? './ariada-output', '..', 'command.log');
  await writeFile(
    logPath,
    [
      `$ ${result.commandLine}`,
      `target: ${result.targetUrl}`,
      result.servedExportDir ? `servedExportDir: ${result.servedExportDir}` : '',
      `exit: ${result.exitCode}`,
      '',
      'stdout:',
      result.stdout,
      '',
      'stderr:',
      result.stderr,
    ].filter(Boolean).join('\n'),
    'utf8',
  );
  process.stdout.write(result.stdout);
  process.stderr.write(result.stderr);
  return result.exitCode;
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((err) => {
    process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
    process.exitCode = 2;
  });
