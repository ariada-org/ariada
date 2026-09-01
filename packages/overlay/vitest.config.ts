// SPDX-License-Identifier: Apache-2.0
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // The painters build real elements and measure them, so they need a DOM.
    environment: 'happy-dom',
    include: ['src/**/*.test.ts'],
    globals: false,
  },
});
