#!/usr/bin/env node
// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

import { main } from './cli.js';

// Awaited rather than chained: the exit code has to be set before the process
// runs out of work, and a callback that returns nothing is one refactor away
// from being a callback that returns before it has set it.
process.exitCode = await main();
