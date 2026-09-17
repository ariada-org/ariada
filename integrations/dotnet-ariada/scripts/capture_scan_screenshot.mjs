#!/usr/bin/env node
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const require = createRequire(new URL('../../../packages/core-playwright/package.json', import.meta.url));
const { chromium } = require('playwright');

const [htmlPath, screenshotPath] = process.argv.slice(2);
if (!htmlPath || !screenshotPath) {
  console.error('Usage: node scripts/capture_scan_screenshot.mjs <html> <screenshot>');
  process.exit(2);
}

await mkdir(dirname(resolve(screenshotPath)), { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 960 } });
await page.goto(`file://${resolve(htmlPath)}`, { waitUntil: 'networkidle' });
await page.screenshot({ path: screenshotPath, fullPage: true });
await browser.close();
