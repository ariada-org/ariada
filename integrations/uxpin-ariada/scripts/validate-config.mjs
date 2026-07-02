#!/usr/bin/env node
// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { findUxpinExportOutput, validateConfig } from '../dist/index.js';

const configPath = resolve('uxpin-ariada.config.json');
const config = JSON.parse(await readFile(configPath, 'utf8'));
const failures = validateConfig(config);

if (!config.$schema?.includes('uxpin-ariada.config.schema.json')) {
  failures.push('config must reference schema/uxpin-ariada.config.schema.json');
}
if (!config.domains?.includes('accessibility')) {
  failures.push('config must include the accessibility domain');
}
if (config.exportDir) {
  const found = await findUxpinExportOutput(resolve(config.exportDir));
  if (!found.markers.includes('assets/uxpin-export.json')) {
    failures.push('fixture export is missing UXPin export metadata');
  }
}

if (failures.length > 0) {
  console.error(`UXPin Ariada recipe validation failed:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log('PASS UXPin Ariada recipe config validates and points at a UXPin-like HTML export');
