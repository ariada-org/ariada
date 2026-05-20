// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
// Author: Alekszandr Bricskin (Agonist Development AB, Sweden, org.nr 559452-5726)
/**
 * E2E suite — core-engine + core-playwright real-browser pipeline.
 *
 * Goal: prove the published `scan(url, opts)` entry point actually launches a
 * real browser (one of chromium / firefox / webkit), navigates to a real EU
 * real-world fixture URL, captures a UnifiedSnapshot, fans out a registered
 * `DomainAnalyzer`, and emits a structurally-valid `ScanResult` with a
 * non-empty report.
 *
 * Coverage:
 *   3 fixtures (banking / checkout / accessibility statement)
 *   × 3 browsers (chromium / firefox / webkit)
 *   = 9 E2E tests per run.
 *
 * Each test:
 *   1. Boots the in-process fixture server (worker-scoped).
 *   2. Navigates to the fixture URL using Playwright's `page` to capture a
 *      proof-of-success screenshot showing the actual rendered fixture.
 *   3. Calls `scan(url, { playwright: { browser: <project> } })` with a
 *      custom contrast-from-page analyzer (no external dep on @ariada/rules-
 *      axe, which is not bundled into @ariada/core-playwright by default).
 *   4. Asserts the ScanResult shape: report.scanId, snapshot timings, at
 *      least one analyzer run, stats sane.
 *
 * Why a custom analyzer? `loadDefaultAnalyzers()` in scanner.ts tries to
 * dynamically import `@ariada/rules-axe`. That package isn't a devDependency
 * of `@ariada/core-playwright` (by design — adapters shouldn't pull rule
 * packs). Passing `opts.analyzers` explicitly is the documented escape
 * hatch.
 */

import { scan } from '../../src/index.js';

import { createPageContrastAnalyzer } from './fixtures/contrast-from-page.js';
import { test, expect } from './fixtures/server.js';

interface FixtureCase {
  /** Test-title-friendly category label. */
  category: 'banking' | 'checkout' | 'statement';
  /** Fixture filename relative to fixtures/eu-real-world. */
  filename: string;
}

const FIXTURES: FixtureCase[] = [
  { category: 'banking', filename: 'bankid-style-2fa-challenge-sv.html' },
  { category: 'checkout', filename: 'klarna-style-checkout-sv.html' },
  { category: 'statement', filename: 'accessibility-statement-fi.html' },
];

for (const fx of FIXTURES) {
  test(`scan() runs end-to-end on ${fx.category} fixture (${fx.filename})`, async ({
    fixtureServer,
    page,
  }, testInfo) => {
    const url = fixtureServer.eu(fx.filename);
    const browserProject = testInfo.project.name as 'chromium' | 'firefox' | 'webkit';

    // 1. Render the fixture inside Playwright's `page` purely for proof-of-
    //    success screenshot capture. The real scan() call below spawns its
    //    own browser via the adapter's launchBrowser() helper — that browser
    //    is what's actually under test.
    await page.goto(url, { waitUntil: 'load' });
    await expect(page).toHaveURL(url);
    await page.screenshot({
      path: testInfo.outputPath(`${fx.category}-rendered.png`),
      fullPage: true,
    });

    // 2. Run the real adapter pipeline. The adapter launches its own browser
    //    matching testInfo.project.name so we exercise all 3 engines.
    const result = await scan(url, {
      playwright: { browser: browserProject, headless: true },
      analyzers: [createPageContrastAnalyzer()],
      timeoutMs: 30_000,
    });

    // 3. Structural assertions on the ScanResult contract.
    expect(result.report.scanId).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/); // ULID
    expect(result.report.url).toBe(url);
    expect(result.report.snapshot.url).toBe(url);
    expect(result.report.snapshot.domOutline.length).toBeGreaterThan(0);
    expect(result.report.snapshot.timings.totalMs).toBeGreaterThanOrEqual(0);
    expect(result.report.stats.analyzersRun).toContain('a11y');
    expect(result.report.stats.elementsScanned).toBeGreaterThan(0);

    // 4. AX-tree presence: only chromium can populate it via CDP today
    //    (firefox / webkit go through the silent-fallback in captureAxTree).
    if (browserProject === 'chromium') {
      expect(result.report.snapshot.axTree.length).toBeGreaterThan(0);
    } else {
      // Even on non-chromium, the field must exist and be a (possibly empty)
      // array — empty is acceptable per the documented fallback.
      expect(Array.isArray(result.report.snapshot.axTree)).toBe(true);
    }

    // 5. Findings object exists and has the analyzer's domain key.
    expect(result.report.findings).toHaveProperty('a11y');
    expect(Array.isArray(result.report.findings['a11y'])).toBe(true);

    // 6. Screenshot embedded inside the snapshot itself (proof that
    //    snapshot.screenshot pipeline ran).
    expect(result.report.snapshot.screenshot).toBeInstanceOf(Uint8Array);
    expect(result.report.snapshot.screenshot!.byteLength).toBeGreaterThan(0);
  });
}
