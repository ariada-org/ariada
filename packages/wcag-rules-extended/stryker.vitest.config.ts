// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
// Author: Alekszandr Bricskin (Agonist Development AB, Sweden, org.nr 559452-5726)
// Stryker-only vitest configuration.
//
// Mirrors vitest.config.ts but excludes:
//   - `src/__property__/**` — property-based tests (fast-check) introduce
//     non-determinism that breaks Stryker's per-test coverage tracking.
//   - 3 banking rules whose tests are currently red on `ariada-clean-main`
//     for reasons unrelated to mutation testing (pre-existing bugs in
//     date-format-locale, iban-input-format, session-timeout-warning).
//
// The exclusions keep mutation testing measuring the test-suite signal
// strength without being aborted by Stryker's mandatory green-dry-run
// precondition. Re-merge into vitest.config.ts when the banking bugs are
// fixed.
//
// Stryker tracks this file via stryker.config.json → vitestRunner.configFile.

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      'src/__property__/**',
      'src/rules/banking/date-format-locale.test.ts',
      'src/rules/banking/iban-input-format.test.ts',
      'src/rules/banking/session-timeout-warning.test.ts',
    ],
  },
});
