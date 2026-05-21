// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
// Author: Alekszandr Bricskin (Agonist Development AB, Sweden, org.nr 559452-5726)
/* eslint-disable no-empty-pattern -- Playwright's fixture protocol mandates
   the object-destructuring pattern for fixture functions, including those
   that intentionally use no built-in fixtures. */
/**
 * Playwright test fixture: ephemeral static-file server for the
 * wcag-rules-extended E2E suite.
 *
 * Serves the EU real-world fixture set from
 * `@ariada-org/test-fixtures/fixtures/eu-real-world/`. Mounted at the
 * URL root, with a smoke-test index page enumerating all files.
 *
 * Worker-scoped (one server per worker) to amortise boot cost and avoid
 * port collisions when `workers > 1`.
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
const EU_DIR = dirname(
  require.resolve('@ariada-org/test-fixtures/fixtures/eu-real-world/README.md'),
);

/**
 * Per-package public shape: `fixtureUrl(name)` returns the URL for an
 * EU-fixture by basename, e.g. `bankid-style-2fa-challenge-sv.html`.
 */
export interface FixtureServer {
  readonly origin: string;
  fixtureUrl: (name: string) => string;
}

function adapt(handle: MultiRootHttpServerHandle): FixtureServer {
  return {
    origin: handle.origin,
    fixtureUrl: (name) => handle.urlFor('', name),
  };
}

type WorkerFixtures = { fixtureServer: FixtureServer };

export const test = base.extend<object, WorkerFixtures>({
  fixtureServer: [
    async ({}, use) => {
      const handle = await startMultiRootHttpServer({
        roots: [{ prefix: '', dir: EU_DIR }],
        indexFromPrefix: '',
      });
      await use(adapt(handle));
      await handle.stop();
    },
    { scope: 'worker' },
  ],
});

export { expect } from '@playwright/test';
