import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const root = resolve(import.meta.dirname, '..');
const preview = `file://${resolve(root, 'scan-evidence/scan-result-preview.html')}`;
const output = resolve(root, 'scan-evidence/screenshots/scan-result.png');

await mkdir(resolve(root, 'scan-evidence/screenshots'), { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 960 } });
await page.goto(preview, { waitUntil: 'load' });
await page.screenshot({ path: output, fullPage: true });
await browser.close();
