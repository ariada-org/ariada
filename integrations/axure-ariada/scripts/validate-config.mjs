#!/usr/bin/env node
// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { findAxurePublishOutput, validateConfig } from '../dist/index.js';

const configPath = resolve('axure-ariada.config.json');
const config = JSON.parse(await readFile(configPath, 'utf8'));
const failures = validateConfig(config);

if (!config.$schema?.includes('axure-ariada.config.schema.json')) {
  failures.push('config must reference schema/axure-ariada.config.schema.json');
}
if (!config.domains?.includes('accessibility')) {
  failures.push('config must include the accessibility domain');
}
if (config.publishDir) {
  const found = await findAxurePublishOutput(resolve(config.publishDir));
  if (!found.markers.includes('resources/scripts/axure/axQuery.js')) {
    failures.push('fixture export is missing Axure axQuery marker');
  }
}

if (failures.length > 0) {
  console.error(`Axure Ariada recipe validation failed:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log('PASS Axure Ariada recipe config validates and points at an Axure-like HTML export');
