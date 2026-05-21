// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/integration/**/*.test.ts'],
    testTimeout: 60_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
});
