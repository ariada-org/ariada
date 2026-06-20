// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    // The cascade endpoint URL used by tests — overridable via env
    env: {
      REVERTER_CASCADE_URL: 'http://localhost:9001',
      REVERTER_GITHUB_API_URL: 'http://localhost:9002',
    },
  },
});
