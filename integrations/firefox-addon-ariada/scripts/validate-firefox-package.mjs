#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../../..');
const manifestPath = resolve(root, 'packages/extension-chrome/.output/chrome-mv3/manifest.json');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));

const firefoxManifest = {
  ...manifest,
  browser_specific_settings: {
    gecko: {
      id: 'extension@ariada.org',
      strict_min_version: '128.0',
    },
  },
};

const failures = [];
if (firefoxManifest.manifest_version !== 3) failures.push('manifest_version must be 3');
if (!firefoxManifest.browser_specific_settings?.gecko?.id)
  failures.push('gecko id is required for AMO signing');
if (!firefoxManifest.background?.service_worker)
  failures.push('background.service_worker must reuse the existing worker');
if (!firefoxManifest.content_scripts?.length)
  failures.push('content script route must be preserved');
if (!firefoxManifest.action?.default_popup) failures.push('popup route must be preserved');

if (failures.length > 0) {
  console.error(`Firefox package validation failed:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log(
  `PASS Firefox MV3 manifest overlay validation: ${firefoxManifest.browser_specific_settings.gecko.id}`,
);
