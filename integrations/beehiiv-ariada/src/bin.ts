#!/usr/bin/env node
// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Recovered from `dist/bin.js` and `dist/bin.d.ts`. The source this was built
// from was never committed; the compiled output is `tsc` with the types
// stripped. Checked with the rebuild check.
//
// The exit code is what the command decided, awaited at the top level. Nothing
// else belongs here: everything a test would want to reach lives one module in.

import { runBeehiivCli } from './cli.js';

process.exitCode = await runBeehiivCli(process.argv.slice(2));
