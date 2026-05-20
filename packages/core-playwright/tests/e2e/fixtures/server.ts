// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
// Author: Alekszandr Bricskin (Agonist Development AB, Sweden, org.nr 559452-5726)
/* eslint-disable no-empty-pattern -- Playwright's fixture protocol mandates
   the object-destructuring pattern for fixture functions, including those
   that intentionally use no built-in fixtures. */
/**
 * Playwright test fixture: ephemeral static-file server for the
 * @ariada-org/core-playwright E2E suite.
 *
 * Mounts two fixture roots:
 *   - Generic axe-core set at `/<name>.html`
 *     (`@ariada-org/test-fixtures/fixtures/*.html`).
 *   - EU real-world set at `/eu/<name>.html`
 *     (`@ariada-org/test-fixtures/fixtures/eu-real-world/*.html`).
 *
 * Worker-scoped to amortise boot cost across the test files in a worker.
 *
 * HTTP server logic lives in {@link @ariada-org/test-fixtures/multi-root-server};
 * this file is the package-local Playwright adapter.
 */

import { createRequire } from 'node:module';
import { dirname } from 'node:path';

import {
  startMultiRootHttpServer,
  type MultiRootHttpServerHandle,
} from '@ariada-org/test-fixtures/multi-root-server';
import { test as base } from '@playwright/test';

const require = createRequire(import.meta.url);
const GENERIC_DIR = dirname(
  require.resolve('@ariada-org/test-fixtures/fixtures/basic-pass.html'),
);
const EU_DIR = dirname(
  require.resolve('@ariada-org/test-fixtures/fixtures/eu-real-world/README.md'),
);

/**
 * Per-package public shape:
 *   - `generic(name)` → URL for a basic axe-core fixture.
 *   - `eu(name)` → URL for an EU real-world fixture.
 */
export interface FixtureServer {
  readonly origin: string;
  generic(name: string): string;
  eu(name: string): string;
}

function adapt(handle: MultiRootHttpServerHandle): FixtureServer {
  return {
    origin: handle.origin,
    generic: (name) => handle.urlFor('', name),
    eu: (name) => handle.urlFor('eu', name),
  };
}

type WorkerFixtures = { fixtureServer: FixtureServer };

export const test = base.extend<object, WorkerFixtures>({
  fixtureServer: [
    async ({}, use) => {
      const handle = await startMultiRootHttpServer({
        roots: [
          { prefix: '', dir: GENERIC_DIR },
          { prefix: 'eu', dir: EU_DIR },
        ],
      });
      await use(adapt(handle));
      await handle.stop();
    },
    { scope: 'worker' },
  ],
});

export { expect } from '@playwright/test';
