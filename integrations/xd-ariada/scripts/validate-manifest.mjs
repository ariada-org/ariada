#!/usr/bin/env node
// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const manifestPath = resolve(import.meta.dirname, '../manifest.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const root = dirname(manifestPath);

for (const field of ['id', 'name', 'version', 'description', 'summary', 'author']) {
  if (typeof manifest[field] !== 'string' || manifest[field].trim() === '') {
    throw new Error(`manifest.${field} must be a non-empty string`);
  }
}

if (manifest.manifestVersion !== 5) {
  throw new Error('manifest.manifestVersion must be 5 for this XD UXP fixture');
}

if (manifest.host?.app !== 'XD' || typeof manifest.host?.minVersion !== 'string') {
  throw new Error('manifest.host must target XD with a minVersion');
}

if (!Array.isArray(manifest.uiEntryPoints) || manifest.uiEntryPoints.length !== 1) {
  throw new Error('manifest.uiEntryPoints must define one panel');
}

const panel = manifest.uiEntryPoints[0];
if (panel.type !== 'panel' || panel.panelId !== 'ariadaPanel') {
  throw new Error('manifest panel must use panelId ariadaPanel');
}

if (!existsSync(join(root, panel.mainPath))) {
  throw new Error(`manifest panel mainPath is missing: ${panel.mainPath}`);
}

console.log('PASS manifest.json validates for the XD panel fixture');
