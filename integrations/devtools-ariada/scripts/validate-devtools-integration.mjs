#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repoRoot = resolve(new URL('../../../', import.meta.url).pathname);
const extensionRoot = resolve(repoRoot, 'packages/extension-chrome');
const checks = [];

function read(relativePath) {
  const absolutePath = resolve(repoRoot, relativePath);
  if (!existsSync(absolutePath)) {
    throw new Error(`Missing required file: ${relativePath}`);
  }
  return readFileSync(absolutePath, 'utf8');
}

function check(name, passed, details) {
  checks.push({ details, name, passed });
}

const devtoolsMain = read('packages/extension-chrome/entrypoints/devtools/main.ts');
check(
  'DevTools page creates an Ariada panel',
  /chrome\?\s*\.devtools\?\s*\.panels\.create|devtools\?\s*\.panels\.create/.test(devtoolsMain) &&
    devtoolsMain.includes('ariada') &&
    devtoolsMain.includes('devtools-panel.html'),
  'Expected chrome.devtools.panels.create("ariada", ..., "devtools-panel.html").',
);

const panel = read('packages/extension-chrome/entrypoints/devtools-panel/Panel.tsx');
check(
  'Panel targets the inspected tab',
  panel.includes('devtools?.inspectedWindow.tabId') || panel.includes('inspectedWindow.tabId'),
  'Expected the panel to read chrome.devtools.inspectedWindow.tabId.',
);
check(
  'Panel reuses extension scanner messaging',
  panel.includes("kind: 'popup_start_scan'") &&
    panel.includes("kind: 'popup_get_last_scan'") &&
    !panel.includes('scanCurrentDocument('),
  'Expected panel to ask the existing background/content scanner to scan, not fork scan logic.',
);

const background = read('packages/extension-chrome/entrypoints/background.ts');
check(
  'Background routes DevTools scan requests to content scanner',
  background.includes("case 'popup_start_scan'") && background.includes("'start_scan'"),
  'Expected background to handle popup_start_scan and dispatch start_scan to the content script.',
);

const content = read('packages/extension-chrome/entrypoints/content.ts');
check(
  'Content script owns the browser scan',
  content.includes('runPageScan') && content.includes("case 'start_scan'"),
  'Expected content script to run the existing in-page scanner after start_scan.',
);

const manifestPath = resolve(extensionRoot, '.output/chrome-mv3/manifest.json');
if (existsSync(manifestPath)) {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  check(
    'Built manifest exposes the DevTools page',
    manifest.devtools_page === 'devtools.html',
    'Expected built manifest devtools_page to equal devtools.html.',
  );
  check(
    'Built panel HTML exists',
    existsSync(resolve(extensionRoot, '.output/chrome-mv3/devtools-panel.html')),
    'Expected .output/chrome-mv3/devtools-panel.html from the extension build.',
  );
} else {
  check(
    'Built manifest exposes the DevTools page',
    false,
    'Run pnpm -F @ariada-org/extension-chrome build before browser load verification.',
  );
}

const failed = checks.filter((item) => !item.passed);
for (const item of checks) {
  const prefix = item.passed ? 'PASS' : 'FAIL';
  console.log(`${prefix}: ${item.name}`);
  console.log(`  ${item.details}`);
}

if (failed.length > 0) {
  process.exitCode = 1;
}
