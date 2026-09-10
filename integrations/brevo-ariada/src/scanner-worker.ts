#!/usr/bin/env node
// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Recovered from `dist/scanner-worker.js` and `dist/scanner-worker.d.ts`. The
// source this was built from was never committed; the compiled output is `tsc`
// with the types stripped. Checked with
// the rebuild check.
//
// The scanner runs in a process of its own, and this is that process. It exists
// so the browser and its memory live somewhere the caller can kill: the parent
// sets a deadline and an output ceiling, and neither can be enforced from inside
// the thing being bounded.
//
// A failure before the worker returns exits 3 with its message on the error
// stream — distinct from whatever the scan itself reports, so the parent can
// tell "the worker broke" from "the page has problems".

import { runScannerWorker } from './scanner.js';

try {
  process.exitCode = await runScannerWorker(process.argv.slice(2));
}
catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 3;
}
