// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { loadConfig, runMarvelScan, type MarvelAriadaConfig } from './index.js';

interface ParsedArgs {
  configPath?: string;
  overrides: MarvelAriadaConfig;
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
      case '--fixture':
      case '--fixture-path':
        parsed.overrides.fixturePath = next();
        break;
      case '--api-endpoint':
        parsed.overrides.apiEndpoint = next();
        break;
      case '--api-token':
        parsed.overrides.apiToken = next();
        break;
      case '--project-id':
        parsed.overrides.projectId = next();
        break;
      case '--share-url':
        parsed.overrides.shareUrl = next();
        break;
      case '--target-url':
        parsed.overrides.targetUrl = next();
        break;
      case '--work-dir':
        parsed.overrides.workDir = next();
        break;
      case '--output-dir':
        parsed.overrides.outputDir = next();
        break;
      case '--browser':
        parsed.overrides.browser = next() as MarvelAriadaConfig['browser'];
        break;
      case '--format':
        parsed.overrides.format = next() as MarvelAriadaConfig['format'];
        break;
      case '--severity-threshold':
        parsed.overrides.severityThreshold = next() as MarvelAriadaConfig['severityThreshold'];
        break;
      case '--timeout-ms':
        parsed.overrides.timeoutMs = Number.parseInt(next(), 10);
        break;
      case '--domains':
        parsed.overrides.domains = next().split(',').map((domain) => domain.trim()).filter(Boolean);
        break;
      default:
        throw new Error(`Unknown option: ${arg}`);
    }
  }
  return parsed;
}

function help(): string {
  return `marvel-ariada

Usage:
  marvel-ariada --fixture ./fixtures/marvel-prototype-export.json --output-dir ./scan-evidence/ariada-output
  marvel-ariada --share-url https://marvelapp.com/prototype/example --domains accessibility,security
  MARVEL_API_TOKEN=... marvel-ariada --api-endpoint https://marvelapp.com/graphql --project-id project_123

Options:
  --config <path>              JSON recipe config. Defaults to ./marvel-ariada.config.json when present.
  --fixture <path>             Recorded Marvel project/export JSON fixture.
  --api-endpoint <url>         Marvel API/GraphQL endpoint.
  --api-token <token>          Marvel API token. Defaults to MARVEL_API_TOKEN.
  --project-id <id>            Marvel project id to request from the API.
  --share-url <url>            Public Marvel prototype URL; scans the URL directly.
  --target-url <url>           Alias for a browser URL already hosting the prototype.
  --work-dir <path>            Directory for generated scan target HTML.
  --output-dir <path>          Ariada machine-readable output directory.
  --domains <list>             Comma-separated Ariada domains to scan.
  --browser <name>             chromium | firefox | webkit.
  --format <name>              human | json | both.
  --severity-threshold <level> minor | moderate | serious | critical.
  --timeout-ms <ms>            Browser navigation timeout.
`;
}

async function main(): Promise<number> {
  const parsed = parseArgs(process.argv.slice(2));
  if (parsed.help) {
    process.stdout.write(help());
    return 0;
  }

  let config: MarvelAriadaConfig = {};
  const configPath = parsed.configPath ?? 'marvel-ariada.config.json';
  try {
    config = await loadConfig(configPath);
  } catch (err) {
    if (parsed.configPath) throw err;
  }
  config = { ...config, ...parsed.overrides };

  const result = await runMarvelScan(config);
  const outputDir = resolve(config.outputDir ?? './ariada-output');
  const evidenceDir = resolve(outputDir, '..');
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(
    resolve(evidenceDir, 'command.log'),
    [
      `$ ${result.commandLine}`,
      `target: ${result.targetUrl}`,
      result.scanTargetPath ? `scanTargetPath: ${result.scanTargetPath}` : '',
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
  await writeFile(resolve(evidenceDir, 'command.exit'), `${result.exitCode}\n`, 'utf8');
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
