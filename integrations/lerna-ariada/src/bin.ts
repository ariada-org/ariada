#!/usr/bin/env node
// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Recovered from `dist/bin.js` and `dist/bin.d.ts`. The source this was built
// from was never committed; the compiled output is `tsc` with the types
// stripped, so the shape comes back from the declaration file and the body is
// the compiled one. Checked with `bash scripts/sverit-vosstanovlennoe.sh`.
//
// The failure is written as one line of JSON on the error stream rather than as
// a stack trace, because this runs inside a workspace tool whose output is read
// by another program as often as by a person.
//
// Two exit codes and they mean different things: 2 says the command line was
// wrong, 3 says something else broke. A scan that found problems exits 1, which
// never reaches here — it is a verdict rather than a failure.

import { UsageError, run } from './index.js';

try {
  process.exitCode = await run(process.argv.slice(2));
}
catch (error) {
  const usage = error instanceof UsageError;
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(JSON.stringify({ level: 'error', code: usage ? 'E_INVALID_ARGUMENT' : 'E_OPERATIONAL', message }) + '\n');
  process.exitCode = usage ? 2 : 3;
}
