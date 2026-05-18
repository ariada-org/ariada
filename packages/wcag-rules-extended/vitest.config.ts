// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
// Author: Alekszandr Bricskin (Agonist Development AB, Sweden, org.nr 559452-5726)
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: 'coverage',
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.d.ts',
        'src/**/index.ts',
        'src/test-utils.ts',
        // Locale message bundles are pure data and don't benefit from
        // line-coverage checks — content is verified by the rules that
        // consume them.
        'src/**/*.locale.ts',
      ],
      // Phase 1C v0.1 thresholds — internal quality gates, not release blockers.
      // Initial baseline (337 tests): 96.5% lines, 79.6% branches, 93.7%
      // funcs, 96.5% statements. Branch coverage is dragged below 80% mainly
      // by the unused-fallback paths in evidence/* DOS-lagen / EN 301 549
      // emitters which require multi-violation real-page fixtures (deferred
      // to v0.2). Re-tune to lines=95 / branches=85 in v0.2 once integration
      // fixtures cover evidence emitters end-to-end.
      thresholds: {
        lines: 90,
        branches: 75,
        functions: 90,
        statements: 90,
      },
    },
  },
});
