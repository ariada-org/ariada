#!/usr/bin/env node
// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { readFile } from 'node:fs/promises';

import { loadMarvelExport, validateConfig } from '../dist/index.js';

const config = JSON.parse(await readFile('marvel-ariada.config.json', 'utf8'));
const failures = validateConfig(config);

if (!config.fixturePath?.includes('fixtures/marvel-prototype-export.json')) {
  failures.push('config must point at the checked Marvel export fixture');
}
if (!config.domains?.includes('accessibility')) {
  failures.push('config must include the accessibility domain');
}

const fixture = await loadMarvelExport(config);
if (fixture.screens.length < 2) failures.push('fixture must contain at least two prototype screens');
if (!fixture.project.name) failures.push('fixture project must have a name');

if (failures.length > 0) {
  console.error(`Marvel Ariada recipe validation failed:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log('PASS Marvel Ariada recipe config validates and points at a Marvel-like prototype export');
