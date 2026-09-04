#!/usr/bin/env node
// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { readFile } from 'node:fs/promises';

import { validateConfig } from '../dist/index.js';

const config = JSON.parse(await readFile('protopie-ariada.config.json', 'utf8'));
const errors = validateConfig(config);
if (errors.length > 0) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log('config ok');
