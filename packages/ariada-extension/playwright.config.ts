// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { defineConfig } from '@playwright/test';

// The extension end-to-end test launches its own persistent context with
// --load-extension, so no shared project browser is configured here.
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 120_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    trace: 'off',
  },
});
