// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
// Author: Alekszandr Bricskin (Agonist Development AB, Sweden, org.nr 559452-5726)
/**
 * Playwright config for @ariada-org/core-playwright real-browser E2E suite.
 *
 * Complements the vitest unit tests (which exercise the scanner against a
 * synthetic fakePage handle) by running the full
 *   core-engine + core-browser + core-playwright
 * pipeline against real browser engines on representative EU real-world
 * HTML fixtures (banking, checkout, accessibility statement).
 *
 * Fixtures are served by an in-process Node HTTP server per worker (see
 * tests/e2e/fixtures/server.ts) — fully deterministic, never reaches
 * outside `localhost`. Shared defaults live in
 * `@ariada-org/test-fixtures/playwright-base`.
 */

import { playwrightE2EBaseConfig } from '@ariada-org/test-fixtures/playwright-base';
import { defineConfig } from '@playwright/test';

export default defineConfig({
  ...playwrightE2EBaseConfig,
  testDir: './tests/e2e',
  outputDir: './test-results',
});
