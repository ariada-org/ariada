// SPDX-License-Identifier: EUPL-1.2
/**
 * Shared Playwright worker-scoped fixture exposing a two-root HTTP server
 * with `generic` axe-core fixtures at the URL root and `eu` real-world
 * fixtures at the `/eu/` prefix.
 *
 * Consumed by per-package adapters in {@link @ariada-org/core-playwright}
 * and {@link @ariada-org/core-browser}, whose E2E suites share an
 * identical fixture-server contract — each package re-exports `test`,
 * `expect`, and the `FixtureServer` type. The only legitimate
 * per-package variation is the suite that owns the file; the fixture
 * surface itself is one shape.
 *
 * If a third consumer needs a different set of mounted roots (e.g.
 * single-root with an index page, like wcag-rules-extended), it uses
 * {@link @ariada-org/test-fixtures/multi-root-server} directly with a
 * package-local Playwright wrapper.
 */

import { createRequire } from 'node:module';
import { dirname } from 'node:path';

import { test as base } from '@playwright/test';

import {
  startMultiRootHttpServer,
  type MultiRootHttpServerHandle,
} from './multi-root-server.js';

const TEST_FIXTURES_REQUIRE = createRequire(import.meta.url);
const GENERIC_DIR = dirname(
  TEST_FIXTURES_REQUIRE.resolve('@ariada-org/test-fixtures/fixtures/basic-pass.html'),
);
const EU_DIR = dirname(
  TEST_FIXTURES_REQUIRE.resolve('@ariada-org/test-fixtures/fixtures/eu-real-world/README.md'),
);

const GENERIC_PREFIX = '';
const EU_PREFIX = 'eu';

/**
 * Public shape exposed to consuming Playwright suites. The two URL
 * builders make per-test code read clearly:
 *
 *   await page.goto(server.generic('basic-pass.html'));
 *   await page.goto(server.eu('bankid-style-2fa-challenge-sv.html'));
 */
export interface FixtureServer {
  readonly origin: string;
  generic(name: string): string;
  eu(name: string): string;
}

function adapt(handle: MultiRootHttpServerHandle): FixtureServer {
  return {
    origin: handle.origin,
    generic: (name) => handle.urlFor(GENERIC_PREFIX, name),
    eu: (name) => handle.urlFor(EU_PREFIX, name),
  };
}

type WorkerFixtures = { fixtureServer: FixtureServer };

/**
 * Playwright `test` object pre-configured with a worker-scoped
 * `fixtureServer` fixture serving the generic + EU roots.
 */
export const test = base.extend<object, WorkerFixtures>({
  fixtureServer: [
    // eslint-disable-next-line no-empty-pattern -- Playwright fixture protocol mandates the destructuring shape.
    async ({}, use) => {
      const handle = await startMultiRootHttpServer({
        roots: [
          { prefix: GENERIC_PREFIX, dir: GENERIC_DIR },
          { prefix: EU_PREFIX, dir: EU_DIR },
        ],
      });
      await use(adapt(handle));
      await handle.stop();
    },
    { scope: 'worker' },
  ],
});

export { expect } from '@playwright/test';
