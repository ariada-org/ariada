import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // The pure unit tests for engine logic moved to `@ariada-org/core-engine` and
    // `@ariada-org/core-playwright`. The shim package keeps only the Playwright
    // integration suite — invoked via `test:e2e` with the integration config —
    // so the default `test` task is intentionally empty.
    include: [],
    exclude: ['tests/integration/**'],
  },
});
