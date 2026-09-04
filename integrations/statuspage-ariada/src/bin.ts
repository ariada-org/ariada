#!/usr/bin/env node
// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

import { runCli } from './cli.js';

process.exitCode = await runCli(process.argv.slice(2));
