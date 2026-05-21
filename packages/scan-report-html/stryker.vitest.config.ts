// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
// Author: Alekszandr Bricskin (Agonist Development AB, Sweden, org.nr 559452-5726)
//
// Stryker-only vitest configuration for @ariada-org/scan-report-html.
//
// Mirrors vitest.config.ts but narrows the test pool to score-related tests
// that exercise src/score.ts (the file under mutation in the POC scope).
//
// The narrower test set lets Stryker complete the dry-run + per-test
// coverage tracking quickly. Wave-2 expansion of mutation scope to all
// src/*.ts will use the broader test set (test/**/*.test.ts).
//
// Stryker tracks this file via stryker.config.json → vitest.configFile.

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/unit/score.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
  },
});
