// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Recovered from `dist/index.js` and `dist/index.d.ts`. The source this was
// built from was never committed; the compiled output is `tsc` with the types
// stripped, so the shapes come back from the declaration file and the bodies
// are the compiled ones. Checked with
// `bash scripts/sverit-vosstanovlennoe.sh`.
//
// The two commands return the same shape of answer, so the caller branches once
// on what was asked for and not again on what came back. Help and version are
// answered here rather than deeper down, because neither needs a workspace and
// both are asked from directories that do not have one.

export * from './aggregate.js';
export * from './arguments.js';
export * from './artifact.js';
export * from './runner.js';
export * from './topology.js';

import { aggregateWorkspace } from './aggregate.js';
import { PACKAGE_VERSION, UsageError, helpText, parseArguments } from './arguments.js';
import { runPackageScan } from './runner.js';
import type { RunnerIo } from './runner.js';

export async function run(argv: readonly string[], io: RunnerIo = {}): Promise<number> {
  const parsed = parseArguments(argv);
  const stdout = io.stdout ?? process.stdout;
  if (parsed.kind === 'help') {
    stdout.write(helpText());
    return 0;
  }
  if (parsed.kind === 'version') {
    stdout.write(PACKAGE_VERSION + '\n');
    return 0;
  }
  if (parsed.kind === 'scan') return (await runPackageScan(parsed.options, io)).exitCode;
  return (await aggregateWorkspace(parsed.options, { ...(io.cwd === undefined ? {} : { cwd: io.cwd }), stdout })).exitCode;
}

export { UsageError };
