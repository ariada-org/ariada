// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
// Author: Alekszandr Bricskin (Agonist Development AB, Sweden, org.nr 559452-5726)
/**
 * Playwright config for @ariada-org/wcag-rules-extended E2E suite.
 *
 * Complements the vitest unit tests (which run in happy-dom synthetic
 * DOM) by exercising the EU real-world HTML fixtures against real
 * browser engines (Chromium, Firefox, WebKit) via @axe-core/playwright.
 *
 * Fixtures are served by an in-process Node HTTP server (see
 * tests/e2e/fixtures/server.ts) so the suite is fully deterministic and
 * never reaches outside `localhost`.
 *
 * This package overrides the shared base with tighter timeouts (the
 * rule-pack tests are pure DOM evaluation, not full pipeline runs) and
 * the less-verbose «only-on-failure» screenshot strategy. Shared
 * defaults: `@ariada-org/test-fixtures/playwright-base`.
 */

import { playwrightE2EBaseConfig } from '@ariada-org/test-fixtures/playwright-base';
import { defineConfig } from '@playwright/test';

const RULE_PACK_TIMEOUT_MS = 30_000;
const RULE_PACK_EXPECT_TIMEOUT_MS = 5_000;

export default defineConfig({
  ...playwrightE2EBaseConfig,
  testDir: './tests/e2e',
  timeout: RULE_PACK_TIMEOUT_MS,
  expect: { timeout: RULE_PACK_EXPECT_TIMEOUT_MS },
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'test-results.json' }],
  ],
  use: {
    ...playwrightE2EBaseConfig.use,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
});
