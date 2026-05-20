// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
// Author: Alekszandr Bricskin (Agonist Development AB, Sweden, org.nr 559452-5726)
/**
 * Playwright test fixture for the @ariada-org/core-playwright E2E suite —
 * re-export of the shared two-root fixture (generic axe-core set at `/`,
 * EU real-world set at `/eu/`) defined in
 * `@ariada-org/test-fixtures/playwright-fixture-generic-eu`.
 *
 * Sister package `@ariada-org/core-browser` consumes the same shared
 * fixture; both packages need an identical server contract for the
 * cross-engine integration tests.
 */
export {
  test,
  expect,
  type FixtureServer,
} from '@ariada-org/test-fixtures/playwright-fixture-generic-eu';
