// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
// Author: Alekszandr Bricskin (Agonist Development AB, Sweden, org.nr 559452-5726)
/* eslint-disable no-empty-pattern -- Playwright's fixture protocol mandates
   the object-destructuring pattern for fixture functions, including those
   that intentionally use no built-in fixtures. */
/**
 * Playwright test fixture: ephemeral static-file server for M7 EU real-world
 * HTML fixtures.
 *
 * Each Playwright worker spins up its own in-process Node HTTP server on a
 * random port, serving the contents of
 * `@ariada-org/test-fixtures/fixtures/eu-real-world/`. The server lifetime is
 * scoped to the worker (auto-stops at teardown), so we avoid both per-test
 * boot cost (≈10-30 ms × N tests) and the cross-test port collisions you
 * get from a single global server when `workers > 1`.
 *
 * Why not `webServer` in playwright.config? The fixture set is in another
 * workspace package and ships zero JavaScript — there is nothing to "start".
 * Spawning a `node` process per worker would add 200-500 ms of cold-start
 * overhead. An in-process server is leaner and gives the tests a typed
 * `fixtureUrl(name)` helper.
 *
 * Author: MENDELEEV (Claude Opus 4.7), 2026-05-17.
 */

import { readFile, readdir } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import { createRequire } from 'node:module';
import type { AddressInfo } from 'node:net';
import { dirname, resolve } from 'node:path';

import { test as base } from '@playwright/test';

// Resolve the EU real-world fixtures directory via @ariada-org/test-fixtures.
// `createRequire` works under both workspace-link and a real npm install.
const require = createRequire(import.meta.url);
const FIXTURES_DIR = dirname(
  require.resolve('@ariada-org/test-fixtures/fixtures/eu-real-world/README.md'),
);

export interface FixtureServer {
  /** Origin URL, e.g. `http://127.0.0.1:54321`. */
  readonly origin: string;
  /** Convenience: `origin + "/" + fixtureName`. */
  fixtureUrl: (name: string) => string;
}

async function listAllowed(): Promise<Set<string>> {
  const entries = await readdir(FIXTURES_DIR, { withFileTypes: true });
  return new Set(
    entries
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.html'))
      .map((entry) => entry.name),
  );
}

async function startFixtureServer(): Promise<{ server: FixtureServer; stop: () => Promise<void> }> {
  const allowed = await listAllowed();

  const httpServer: Server = createServer((req, res) => {
    const raw = (req.url ?? '/').split('?')[0] ?? '/';
    const name = raw === '/' || raw === '' ? '__index__' : raw.slice(1);

    if (name === '__index__') {
      // Cheap index page used by smoke tests
      res.statusCode = 200;
      res.setHeader('content-type', 'text/html; charset=utf-8');
      res.end(
        `<!doctype html><html lang="en"><body><h1>Ariada EU fixtures</h1><ul>${Array.from(
          allowed,
        )
          .sort((a, b) => a.localeCompare(b))
          .map((n) => `<li><a href="/${n}">${n}</a></li>`)
          .join('')}</ul></body></html>`,
      );
      return;
    }

    if (!allowed.has(name)) {
      res.statusCode = 404;
      res.setHeader('content-type', 'text/plain; charset=utf-8');
      res.end(`fixture not found: ${name}`);
      return;
    }

    readFile(resolve(FIXTURES_DIR, name), 'utf8')
      .then((body) => {
        res.statusCode = 200;
        res.setHeader('content-type', 'text/html; charset=utf-8');
        res.setHeader('cache-control', 'no-store');
        res.end(body);
        return undefined;
      })
      .catch((err: unknown) => {
        res.statusCode = 500;
        res.end(err instanceof Error ? err.message : 'error');
      });
  });

  await new Promise<void>((r, rej) => {
    httpServer.once('error', rej);
    httpServer.listen(0, '127.0.0.1', r);
  });

  const addr = httpServer.address() as AddressInfo;
  const origin = `http://127.0.0.1:${addr.port}`;

  return {
    server: {
      origin,
      fixtureUrl: (name) => `${origin}/${name}`,
    },
    stop: () =>
      new Promise<void>((r, rej) =>
        httpServer.close((error) => {
          if (error) rej(error);
          else r();
        }),
      ),
  };
}

/**
 * Playwright test object with an injected `fixtureServer` fixture. Worker-
 * scoped (one server per worker, reused across all tests in that worker).
 */
// Worker-scoped fixture types — first generic = test-scoped (none),
// second generic = worker-scoped (our fixture server).
type WorkerFixtures = { fixtureServer: FixtureServer };

export const test = base.extend<object, WorkerFixtures>({
  fixtureServer: [
    async ({}, use) => {
      const { server, stop } = await startFixtureServer();
      await use(server);
      await stop();
    },
    { scope: 'worker' },
  ],
});

export { expect } from '@playwright/test';
