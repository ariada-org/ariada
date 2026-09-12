// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    // axe-core reads a document at import time, so the payload cannot be handed
    // to the real thing without one. The rest of the suite does not need it.
    environment: 'happy-dom',
  },
});
