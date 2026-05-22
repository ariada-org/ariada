// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
// Author: Alekszandr Bricskin (Agonist Development AB, Sweden, org.nr 559452-5726)
/**
 * Playwright config for @ariada-org/core-playwright real-browser E2E suite.
 *
 * Complements the 5 vitest unit tests (which exercise the scanner against a
 * synthetic fakePage handle) by running the full
 *   core-engine + core-browser + core-playwright
 * pipeline against REAL browser engines (Chromium, Firefox, WebKit) on
 * representative EU real-world HTML fixtures (banking, checkout, accessibility
 * statement). Provides cross-engine integration confidence that:
 *   - The Playwright adapter launches each browser correctly.
 *   - captureSnapshot() returns a non-empty UnifiedSnapshot.
 *   - A registered DomainAnalyzer runs against the snapshot + live page.
 *   - The color-contrast analyzer fires end-to-end when fed a snapshot
 *     enriched with computed-style fg/bg properties from the live page.
 *
 * Static fixtures are served by an in-process Node HTTP server per worker
 * (see tests/e2e/fixtures/server.ts) — fully deterministic, never reaches
 * outside `localhost`.
 *
 * `screenshot: 'on'` is intentional: we capture proof-of-success screenshots
 * for every test as evidence the real-browser pipeline ran (not just `only-on-
 * failure` which would only fire on regressions).
 */

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  outputDir: './test-results',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 4,
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'test-results/results.json' }],
  ],
  use: {
    trace: 'retain-on-failure',
    screenshot: 'on',
    video: 'off',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
});
