// SPDX-License-Identifier: EUPL-1.2
/**
 * Shared Playwright E2E config defaults for ariada monorepo packages.
 *
 * Each per-package `playwright.config.ts` imports this base and spreads
 * it into its own `defineConfig({ ... })`, overriding only what differs
 * for that package (typically: testDir, timeout values, reporter
 * outputFile, and trace/screenshot strategy).
 *
 * The base encodes the cross-engine matrix (Chromium / Firefox / WebKit)
 * and the parallelisation + CI safety settings (`forbidOnly: !!CI`,
 * `fullyParallel`, `retries: 0`, `workers: 4`). It deliberately does NOT
 * set `webServer` — each package boots its fixture server via the
 * `multi-root-server` Playwright fixture instead, so there is no
 * baseURL invariant to manage globally.
 *
 * Why not a factory function: a plain readonly const + spread is the
 * cleanest contract — consumers can see every default in the type
 * surface, override individual fields with normal object-literal syntax,
 * and never need to pass a callback. The `as const` keeps each field
 * narrowly typed so spread + Playwright's `defineConfig` infer
 * correctly.
 */
import { devices, type PlaywrightTestConfig } from '@playwright/test';

/**
 * The cross-engine matrix used by every E2E suite in this monorepo.
 * Re-exported so consumers don't have to import `devices` themselves
 * when they just want the default matrix.
 */
export const PLAYWRIGHT_E2E_BROWSER_MATRIX: PlaywrightTestConfig['projects'] = [
  { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
  { name: 'webkit', use: { ...devices['Desktop Safari'] } },
];

const DEFAULT_TIMEOUT_MS = 60_000;
const DEFAULT_EXPECT_TIMEOUT_MS = 10_000;
const DEFAULT_WORKERS = 4;
const DEFAULT_RETRIES = 0;

/**
 * Conservative defaults shared by all ariada E2E suites. Spread into a
 * per-package config and override only what differs.
 *
 * Example:
 *
 *     import { defineConfig } from '@playwright/test';
 *     import { playwrightE2EBaseConfig }
 *       from '@ariada-org/test-fixtures/playwright-base';
 *     export default defineConfig({
 *       ...playwrightE2EBaseConfig,
 *       testDir: './tests/e2e',
 *     });
 */
export const playwrightE2EBaseConfig: PlaywrightTestConfig = {
  timeout: DEFAULT_TIMEOUT_MS,
  expect: { timeout: DEFAULT_EXPECT_TIMEOUT_MS },
  fullyParallel: true,
  forbidOnly: process.env['CI'] !== undefined && process.env['CI'] !== '',
  retries: DEFAULT_RETRIES,
  workers: DEFAULT_WORKERS,
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
  projects: PLAYWRIGHT_E2E_BROWSER_MATRIX,
};
