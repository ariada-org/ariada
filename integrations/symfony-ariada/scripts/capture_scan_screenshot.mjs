#!/usr/bin/env node
import { mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const requireFromPlaywrightPackage = createRequire(
 pathToFileURL(join(root, '..', '..', 'packages', 'core-playwright', 'package.json')),
);
const { chromium } = requireFromPlaywrightPackage('playwright');

const evidenceDir = join(root, 'scan-evidence');
const preview = join(evidenceDir, 'scan-result-preview.html');
const screenshots = join(evidenceDir, 'screenshots');
await mkdir(screenshots, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto(pathToFileURL(preview).href);
await page.screenshot({ path: join(screenshots, 'scan-result.png'), fullPage: true });
await browser.close();
