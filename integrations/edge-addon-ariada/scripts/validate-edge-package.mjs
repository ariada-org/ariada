#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../../..');
const manifestPath = resolve(root, 'packages/extension-chrome/.output/chrome-mv3/manifest.json');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));

const failures = [];
if (manifest.manifest_version !== 3) failures.push('manifest_version must be 3');
if (!manifest.name || !manifest.version || !manifest.description) failures.push('name, version, and description are required');
if (!manifest.action?.default_popup) failures.push('action.default_popup must point to the existing popup');
if (!manifest.background?.service_worker) failures.push('background.service_worker must reuse the existing extension worker');
if (!manifest.permissions?.includes('activeTab')) failures.push('activeTab permission is required for tab scans');
if (!manifest.permissions?.includes('scripting')) failures.push('scripting permission is required for injection');
if (manifest.externally_connectable) failures.push('externally_connectable is not needed for the Edge listing');

if (failures.length > 0) {
  console.error(`Edge package validation failed:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log(`PASS Edge MV3 manifest validation: ${manifest.name} ${manifest.version}`);

