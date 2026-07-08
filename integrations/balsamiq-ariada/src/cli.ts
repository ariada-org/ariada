#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

import { buildAriadaCliArgs, type BalsamiqScanConfig } from './index.js';

function parseArgs(argv: string[]) {
  const config: BalsamiqScanConfig = {};
  let printOnly = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg) continue;
    const readNext = () => {
      const next = argv[index + 1];
      if (!next) throw new Error(`Missing value for ${arg}`);
      index += 1;
      return next;
    };

    if (arg === '--print') {
      printOnly = true;
    } else if (arg === '--target-url') {
      config.targetUrl = readNext();
    } else if (arg === '--export-path') {
      config.exportPath = readNext();
    } else if (arg === '--output-dir') {
      config.outputDir = readNext();
    } else if (arg === '--severity-threshold') {
      config.severityThreshold = readNext();
    } else if (arg === '--format') {
      const format = readNext();
      if (format !== 'json' && format !== 'html' && format !== 'junit') {
        throw new Error(`Unsupported format: ${format}`);
      }
      config.format = format;
    } else if (!arg.startsWith('--') && !config.exportPath) {
      config.exportPath = arg;
    } else {
      throw new Error(`Unknown or incomplete argument: ${arg}`);
    }
  }

  return { config, printOnly };
}

const { config, printOnly } = parseArgs(process.argv.slice(2));
const args = buildAriadaCliArgs(config);

if (printOnly) {
  console.log(['npx', '@ariada-org/cli', ...args].join(' '));
} else {
  const result = spawnSync('npx', ['@ariada-org/cli', ...args], { stdio: 'inherit' });
  process.exit(result.status ?? 1);
}
