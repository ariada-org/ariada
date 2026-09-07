#!/usr/bin/env node
// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Recovered from `dist/bin.js` and `dist/bin.d.ts`. The source this was built
// from was never committed; the compiled output is `tsc` with the types
// stripped, so the shape comes back from the declaration file and the body is
// the compiled one. Checked with `bash scripts/sverit-vosstanovlennoe.sh`.
//
// Three lines, and the whole of the reason is that the command line lives in a
// module somebody can import and call. Everything a program needs beyond that
// is the exit code, and setting it rather than calling exit lets the process
// finish writing what it has already said.

import { main } from "./cli.js";

process.exitCode = await main();
