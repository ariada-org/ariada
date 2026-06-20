#!/usr/bin/env node
// SPDX-License-Identifier: EUPL-1.2
//
// Screenshot capture for differential accessibility gate build evidence.
// Renders the HTML output files produced by smoke-stub.mjs and the
// Vercel dashboard mock fixture, then writes screenshots to the
// var/build-evidence/diff-gate/ directory.

import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
import { existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const MONO_ROOT = resolve(HERE, '..', '..', '..');
const EVIDENCE_DIR = resolve(MONO_ROOT, 'var', 'build-evidence', 'diff-gate');
const FIXTURES_DIR = resolve(MONO_ROOT, 'packages', 'ariada-test-fixtures', 'fixtures');

mkdirSync(EVIDENCE_DIR, { recursive: true });

const browser = await chromium.launch({ headless: true });

try {
  // Screenshot 1 — PR blocked on regression
  console.log('Capturing 01-pr-blocked-regression.png...');
  {
    const page = await browser.newPage();
    await page.setViewportSize({ width: 800, height: 600 });
    const htmlPath = resolve(EVIDENCE_DIR, '01-pr-blocked-regression.html');
    if (!existsSync(htmlPath)) throw new Error(`Missing: ${htmlPath}`);
    await page.goto(`file://${htmlPath}`);
    await page.waitForLoadState('networkidle');
    await page.screenshot({
      path: resolve(EVIDENCE_DIR, '01-pr-blocked-regression.png'),
      fullPage: true,
    });
    await page.close();
  }

  // Screenshot 2 — PR passing with legacy debt
  console.log('Capturing 02-pr-passing-legacy-debt.png...');
  {
    const page = await browser.newPage();
    await page.setViewportSize({ width: 800, height: 600 });
    const htmlPath = resolve(EVIDENCE_DIR, '02-pr-passing-legacy-debt.html');
    if (!existsSync(htmlPath)) throw new Error(`Missing: ${htmlPath}`);
    await page.goto(`file://${htmlPath}`);
    await page.waitForLoadState('networkidle');
    await page.screenshot({
      path: resolve(EVIDENCE_DIR, '02-pr-passing-legacy-debt.png'),
      fullPage: true,
    });
    await page.close();
  }

  // Screenshot 3 — Vercel blocked
  console.log('Capturing 03-vercel-blocked.png...');
  {
    const page = await browser.newPage();
    await page.setViewportSize({ width: 960, height: 700 });
    const mockPath = resolve(FIXTURES_DIR, 'vercel-dashboard-mock.html');
    if (!existsSync(mockPath)) throw new Error(`Missing: ${mockPath}`);
    await page.goto(`file://${mockPath}?state=blocked`);
    await page.waitForLoadState('networkidle');
    await page.screenshot({
      path: resolve(EVIDENCE_DIR, '03-vercel-blocked.png'),
      fullPage: true,
    });
    await page.close();
  }

  // Screenshot 4 — Vercel passing
  console.log('Capturing 04-vercel-passing.png...');
  {
    const page = await browser.newPage();
    await page.setViewportSize({ width: 960, height: 700 });
    const mockPath = resolve(FIXTURES_DIR, 'vercel-dashboard-mock.html');
    await page.goto(`file://${mockPath}?state=passing`);
    await page.waitForLoadState('networkidle');
    await page.screenshot({
      path: resolve(EVIDENCE_DIR, '04-vercel-passing.png'),
      fullPage: true,
    });
    await page.close();
  }

  console.log(`\nAll screenshots saved to: ${EVIDENCE_DIR}`);
} finally {
  await browser.close();
}
