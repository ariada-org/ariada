#!/usr/bin/env node
// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { emitError } from './errors.js';
import { EXIT_RUNTIME_ERROR } from './exit-codes.js';
import { run } from './parser.js';

void (async () => {
  try {
    const exitCode = await run(process.argv.slice(2));
    process.exit(exitCode);
  } catch (err) {
    // Belt-and-suspenders: parser.run() catches CommanderError internally and
    // already maps to exit codes. This catch handles truly-unexpected escapes.
    emitError(err, process.stderr);
    process.exit(EXIT_RUNTIME_ERROR);
  }
})();
