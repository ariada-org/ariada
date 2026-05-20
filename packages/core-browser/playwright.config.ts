// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
// Author: Alekszandr Bricskin (Agonist Development AB, Sweden, org.nr 559452-5726)
/**
 * Playwright config for @ariada-org/core-browser real-browser E2E suite.
 *
 * Complements the vitest unit tests (which exercise the adapter against
 * happy-dom) by running `captureBrowserSnapshot` inside real browser
 * pages (Chromium / Firefox / WebKit) loaded with the EU real-world
 * fixtures. This verifies that the in-browser adapter's DOM walk
 * produces the same shape of `UnifiedSnapshot` across all three engines.
 *
 * Shared defaults live in `@ariada-org/test-fixtures/playwright-base`.
 */

import { playwrightE2EBaseConfig } from '@ariada-org/test-fixtures/playwright-base';
import { defineConfig } from '@playwright/test';

export default defineConfig({
  ...playwrightE2EBaseConfig,
  testDir: './tests/e2e',
  outputDir: './test-results',
});
