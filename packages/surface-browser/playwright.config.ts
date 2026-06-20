// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

/**
 * Playwright config for @ariada-org/surface-browser E2E suite.
 *
 * The browser surface targets the Chrome DevTools / bookmarklet context,
 * so Chromium-only testing is the correct scope. Firefox and WebKit are
 * excluded — the DevTools panel entry point targets Chrome-only APIs
 * (chrome.devtools.*).
 */
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  outputDir: './test-results',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: 0,
  workers: 2,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        browserName: 'chromium',
        headless: true,
      },
    },
  ],
});
