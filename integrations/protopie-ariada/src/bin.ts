// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { loadConfig, runProtoPieScan, summarizeStaticSurface, type ProtoPieAriadaConfig } from './index.js';

interface ParsedArgs {
  configPath?: string;
  overrides: ProtoPieAriadaConfig;
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
      case '--pie-bundle-dir':
        parsed.overrides.pieBundleDir = next();
        break;
      case '--host-dir':
        parsed.overrides.hostDir = next();
        break;
      case '--target-url':
        parsed.overrides.targetUrl = next();
        break;
      case '--output-dir':
        parsed.overrides.outputDir = next();
        break;
      case '--browser':
        parsed.overrides.browser = next() as ProtoPieAriadaConfig['browser'];
        break;
      case '--format':
        parsed.overrides.format = next() as ProtoPieAriadaConfig['format'];
        break;
      case '--severity-threshold':
        parsed.overrides.severityThreshold = next() as ProtoPieAriadaConfig['severityThreshold'];
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
  return `protopie-ariada

Usage:
  protopie-ariada --host-dir ./fixtures/protopie-cloud-player --output-dir ./scan-evidence/ariada-output
  protopie-ariada --target-url https://cloud.protopie.io/p/... --domains accessibility,privacy

Options:
  --config <path>              JSON recipe config. Defaults to ./protopie-ariada.config.json when present.
  --pie-bundle-dir <path>      Recorded ProtoPie .pie/scene metadata fixture for static surface notes.
  --host-dir <path>            Representative hosted ProtoPie Cloud/Player HTML shell to scan locally.
  --target-url <url>           Hosted ProtoPie Cloud URL; skips local static serving.
  --output-dir <path>          Ariada machine-readable output directory.
  --domains <list>             Comma-separated Ariada domains to scan.
  --browser <name>             chromium | firefox | webkit.
  --format <name>              human | json | both.
  --severity-threshold <level> minor | moderate | serious | critical.
  --timeout-ms <ms>            Browser navigation timeout.
  --entry-file <path>          Entry HTML file inside the host fixture.
`;
}

async function main(): Promise<number> {
  const parsed = parseArgs(process.argv.slice(2));
  if (parsed.help) {
    process.stdout.write(help());
    return 0;
  }

  let config: ProtoPieAriadaConfig = {};
  const configPath = parsed.configPath ?? 'protopie-ariada.config.json';
  try {
    config = await loadConfig(configPath);
  } catch (err) {
    if (parsed.configPath) throw err;
  }
  config = { ...config, ...parsed.overrides };

  const result = await runProtoPieScan(config);
  const evidenceDir = resolve(config.outputDir ?? './ariada-output', '..');
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(resolve(evidenceDir, 'command.exit'), `${result.exitCode}\n`, 'utf8');
  await writeFile(
    resolve(evidenceDir, 'command.log'),
    [
      `$ ${result.commandLine}`,
      `target: ${result.targetUrl}`,
      result.servedHostDir ? `servedHostDir: ${result.servedHostDir}` : '',
      result.bundle ? `protoPieBundle: ${result.bundle.dir}` : '',
      result.bundle ? `staticSurface: ${summarizeStaticSurface(result.bundle).join(' | ')}` : '',
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
