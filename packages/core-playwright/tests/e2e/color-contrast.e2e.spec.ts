// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
// Author: Alekszandr Bricskin (Agonist Development AB, Sweden, org.nr 559452-5726)
/**
 * E2E suite — color-contrast pipeline (Deliverable 3).
 *
 * Proves the bundled `colorContrastAnalyzer` from @ariada-org/core-engine fires
 * correctly when fed a snapshot enriched from a REAL browser's computed
 * styles (via the `enrichSnapshotWithComputedContrast` helper, which
 * mirrors what a production CDP+CSSOM adapter would do).
 *
 * Coverage:
 *   - 1 fixture authored with intentional low-contrast text
 *     (`color-contrast.html` — `.low1` is #bbbbbb on #ffffff, ratio ≈ 2.85:1)
 *   × 3 browsers (chromium / firefox / webkit)
 *   = 3 E2E tests per run.
 *
 * Each test:
 *   1. Navigates Playwright's `page` to the fixture URL (for screenshot
 *      evidence + as the analyzer's source-of-truth for getComputedStyle).
 *   2. Runs `scan()` with the page-contrast analyzer.
 *   3. Asserts the resulting `Finding[]` contains at least one
 *      `wcag-1.4.3-contrast-minimum` violation.
 *   4. Captures a proof-of-success screenshot.
 */

import { COLOR_CONTRAST_RULE_ID } from '@ariada-org/core-engine';

import { scan } from '../../src/index.js';

import { createPageContrastAnalyzer } from './fixtures/contrast-from-page.js';
import { test, expect } from './fixtures/server.js';


test('color-contrast analyzer fires end-to-end against the low-contrast fixture', async ({
  fixtureServer,
  page,
}, testInfo) => {
  const url = fixtureServer.generic('color-contrast.html');
  const browserProject = testInfo.project.name as 'chromium' | 'firefox' | 'webkit';

  await page.goto(url, { waitUntil: 'load' });
  await page.screenshot({
    path: testInfo.outputPath('color-contrast-rendered.png'),
    fullPage: true,
  });

  const result = await scan(url, {
    playwright: { browser: browserProject, headless: true },
    analyzers: [createPageContrastAnalyzer()],
    timeoutMs: 30_000,
  });

  const a11yFindings = result.report.findings['a11y'] ?? [];
  const contrastFindings = a11yFindings.filter(
    (f) => f.ruleId === COLOR_CONTRAST_RULE_ID,
  );

  expect(
    contrastFindings.length,
    `expected ≥1 ${COLOR_CONTRAST_RULE_ID} finding, got ${a11yFindings.length} a11y findings total`,
  ).toBeGreaterThan(0);

  // Validate the Finding shape per @ariada-org/core-engine `Finding` interface.
  const sample = contrastFindings[0]!;
  expect(sample.scanId).toBe(result.report.scanId);
  expect(sample.domain).toBe('a11y');
  expect(sample.severity).toBe('serious');
  expect(sample.message).toMatch(/insufficient contrast ratio/i);
  expect(sample.message).toMatch(/required\s+4\.5:1/);
  expect(sample.wcagMapping).toContain('1.4.3');
  expect(sample.regulatoryMapping).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ framework: 'WCAG', code: '1.4.3' }),
      expect.objectContaining({ framework: 'EN 301 549', code: '9.1.4.3' }),
    ]),
  );
});
