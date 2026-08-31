#!/usr/bin/env node
// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const manifestPath = resolve(root, 'manifest.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const failures = [];

if (manifest.version !== 2) failures.push('manifest.version must be 2 for relative paths');
if (typeof manifest.name !== 'string' || manifest.name.length === 0) failures.push('manifest.name is required');
if (typeof manifest.description !== 'string' || manifest.description.length === 0) {
  failures.push('manifest.description is required');
}
if (typeof manifest.code !== 'string' || !manifest.code.endsWith('.js')) {
  failures.push('manifest.code must point to a JavaScript file');
}
if (typeof manifest.icon !== 'string' || manifest.icon.length === 0) failures.push('manifest.icon is required');
if (!Array.isArray(manifest.permissions)) failures.push('manifest.permissions must be an array');
if (!manifest.permissions.includes('content:read')) failures.push('content:read permission is required');
if (manifest.permissions.includes('content:write')) failures.push('content:write must not be requested for read-only export');
if (!existsSync(resolve(root, manifest.icon ?? ''))) failures.push(`missing icon file: ${manifest.icon}`);

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log(`Penpot manifest validated: ${manifestPath}`);
