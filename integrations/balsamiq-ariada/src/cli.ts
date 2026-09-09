#!/usr/bin/env node
// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// This file is released from that comparison, and is no longer held by the
// comparison with the module it was recovered from: the argument walk came out
// of the compiler as one chain of equality tests, flat enough to fail the
// complexity limit standing on publication.
//
// The behavioural checks in the tests beside it were
// written while the comparison still held, and are the guarantee now. They load
// this source rather than the built module, because nothing rebuilds that one
// and a guard that cannot see the edit it guards is not a guard. The release is
// recorded; a divergence
// reported by the rebuild check on this package is
// expected.
import { spawnSync } from 'node:child_process';

import { buildAriadaCliArgs, type BalsamiqScanConfig } from './index.js';

// Only the fields that accept any string. The format is not among them: it has
// a closed set of values, and listing it here would say "a string will do" —
// which the type checker refused and the linter cannot see.
type StringField = 'targetUrl' | 'exportPath' | 'outputDir' | 'severityThreshold';

const VALUE_FLAGS: Record<string, StringField> = {
  '--target-url': 'targetUrl',
  '--export-path': 'exportPath',
  '--output-dir': 'outputDir',
  '--severity-threshold': 'severityThreshold',
};

/**
 * One argument, applied.
 *
 * Returns how many arguments it consumed so the walk stays a walk: a flag that
 * takes a value eats two, and the caller does not have to know which is which.
 * An unknown flag is refused rather than skipped — a misspelling that is ignored
 * produces a run with a default nobody chose, and the report says nothing about
 * it.
 */
function applyArg(
  argv: string[],
  index: number,
  arg: string,
  config: BalsamiqScanConfig,
): { consumed: number; printOnly?: boolean } {
  if (arg === '--print') return { consumed: 1, printOnly: true };

  const valueFor = (flag: string): string => {
    const next = argv[index + 1];
    if (!next) throw new Error(`Missing value for ${flag}`);
    return next;
  };

  const known = VALUE_FLAGS[arg];
  if (known) {
    config[known] = valueFor(arg);
    return { consumed: 2 };
  }
  if (arg === '--format') {
    const format = valueFor(arg);
    if (format !== 'json' && format !== 'html' && format !== 'junit') {
      throw new Error(`Unsupported format: ${format}`);
    }
    config.format = format;
    return { consumed: 2 };
  }
  if (!arg.startsWith('--') && !config.exportPath) {
    config.exportPath = arg;
    return { consumed: 1 };
  }
  throw new Error(`Unknown or incomplete argument: ${arg}`);
}

function parseArgs(argv: string[]) {
  const config: BalsamiqScanConfig = {};
  let printOnly = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg) continue;
    const applied = applyArg(argv, index, arg, config);
    if (applied.printOnly) printOnly = true;
    index += applied.consumed - 1;
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
