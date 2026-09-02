#!/usr/bin/env node
import { access } from 'node:fs/promises';
import { constants } from 'node:fs';

function required(name) {
  const value = process.env[name];
  if (value === undefined || value.trim() === '') throw new Error(`Missing required environment variable ${name}.`);
  return value;
}

async function existingBrowser() {
  const candidates = [
    process.env.SITECORE_BROWSER_EXECUTABLE,
    process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : undefined,
    process.platform === 'linux' ? '/usr/bin/google-chrome' : undefined,
    process.platform === 'linux' ? '/usr/bin/chromium' : undefined,
  ].filter(Boolean);
  for (const candidate of candidates) {
    try { await access(candidate, constants.X_OK); return candidate; } catch { /* next candidate */ }
  }
  throw new Error('No browser executable found; set SITECORE_BROWSER_EXECUTABLE.');
}

const cmUrl = new URL(required('SITECORE_CM_URL'));
if (!['http:', 'https:'].includes(cmUrl.protocol) || cmUrl.username !== '' || cmUrl.password !== '') {
  throw new Error('SITECORE_CM_URL must be a credential-free HTTP(S) origin.');
}
const username = required('SITECORE_USERNAME');
const password = required('SITECORE_PASSWORD');
const itemId = required('SITECORE_TEST_ITEM_ID');
if (!/^\{?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\}?$/iu.test(itemId)) {
  throw new Error('SITECORE_TEST_ITEM_ID must be a GUID.');
}
const language = process.env.SITECORE_TEST_LANGUAGE ?? 'en';
const version = process.env.SITECORE_TEST_VERSION ?? '1';
const { chromium } = await import('playwright');
const browser = await chromium.launch({ executablePath: await existingBrowser(), headless: true });
try {
  const context = await browser.newContext({ ignoreHTTPSErrors: process.env.SITECORE_IGNORE_HTTPS_ERRORS === 'true' });
  const page = await context.newPage();
  await page.goto(new URL('/sitecore/login', cmUrl).href, { waitUntil: 'domcontentloaded', timeout: 45000 });
  const usernameInput = page.locator('input[name="UserName"], input[name="Username"], #UserName, #Username').first();
  const passwordInput = page.locator('input[name="Password"], #Password').first();
  await usernameInput.fill(username, { timeout: 15000 });
  await passwordInput.fill(password, { timeout: 15000 });
  await page.locator('button[type="submit"], input[type="submit"]').first().click();
  await page.waitForLoadState('domcontentloaded', { timeout: 45000 });
  const panelUrl = new URL('/sitecore/shell/Applications/Ariada/Scan.aspx', cmUrl);
  panelUrl.searchParams.set('itemId', itemId);
  panelUrl.searchParams.set('language', language);
  panelUrl.searchParams.set('version', version);
  await page.goto(panelUrl.href, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.locator('[data-ariada-action="scan"]').click({ timeout: 15000 });
  await page.waitForSelector('[data-ariada-state="complete"]', { timeout: 180000 });
  const reportHref = await page.locator('[data-ariada-full-report="true"]').getAttribute('href');
  if (reportHref === null) throw new Error('Installed panel did not expose its full-report link.');
  const response = await context.request.get(new URL(reportHref, cmUrl).href);
  if (!response.ok() || !response.headers()['content-type']?.includes('application/json')) {
    throw new Error(`Full report request failed with ${response.status()}.`);
  }
  const report = await response.json();
  if (report.$schema !== 'https://ariada.org/schemas/cli-scan.v1.json') throw new Error('Full report schema is invalid.');
  process.stdout.write(`SITECORE_SANDBOX_ACTUAL_PASS ${JSON.stringify({ itemId, total: report.summary?.total, exitCode: report.exitCode })}\n`);
} finally {
  await browser.close();
}

