// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
// Author: Alekszandr Bricskin (Agonist Development AB, Sweden, org.nr 559452-5726)
/* eslint-disable no-empty-pattern -- Playwright fixture protocol. */
/**
 * Playwright test fixture: ephemeral static-file server for the
 * @ariada-org/core-browser E2E suite.
 *
 * Same shape as packages/core-playwright/tests/e2e/fixtures/server.ts but
 * duplicated here to keep each package self-contained (no test-time import
 * across packages).
 */

import { readFile, readdir } from 'node:fs/promises';
import { createServer, type Server, type ServerResponse } from 'node:http';
import { createRequire } from 'node:module';
import type { AddressInfo } from 'node:net';
import { dirname, resolve } from 'node:path';

import { test as base } from '@playwright/test';

const require = createRequire(import.meta.url);

const GENERIC_DIR = dirname(
  require.resolve('@ariada-org/test-fixtures/fixtures/basic-pass.html'),
);
const EU_DIR = dirname(
  require.resolve('@ariada-org/test-fixtures/fixtures/eu-real-world/README.md'),
);

export interface FixtureServer {
  readonly origin: string;
  generic(name: string): string;
  eu(name: string): string;
}

async function listHtml(dir: string): Promise<Set<string>> {
  const entries = await readdir(dir, { withFileTypes: true });
  return new Set(
    entries
      .filter((e) => e.isFile() && e.name.toLowerCase().endsWith('.html'))
      .map((e) => e.name),
  );
}

async function startFixtureServer(): Promise<{
  server: FixtureServer;
  stop: () => Promise<void>;
}> {
  const [generic, eu] = await Promise.all([listHtml(GENERIC_DIR), listHtml(EU_DIR)]);

  const httpServer: Server = createServer((req, res) => {
    const raw = (req.url ?? '/').split('?')[0] ?? '/';
    const path = raw.replace(/^\/+/, '');

    if (path.startsWith('eu/')) {
      const name = path.slice('eu/'.length);
      if (!eu.has(name)) {
        res.statusCode = 404;
        res.end(`eu fixture not found: ${name}`);
        return;
      }
      void serve(res, resolve(EU_DIR, name));
      return;
    }

    if (!generic.has(path)) {
      res.statusCode = 404;
      res.end(`generic fixture not found: ${path}`);
      return;
    }
    void serve(res, resolve(GENERIC_DIR, path));
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
      generic: (name) => `${origin}/${name}`,
      eu: (name) => `${origin}/eu/${name}`,
    },
    stop: () =>
      new Promise<void>((r, rej) =>
        httpServer.close((e) => {
          if (e) rej(e);
          else r();
        }),
      ),
  };
}

async function serve(res: ServerResponse, file: string): Promise<void> {
  try {
    const body = await readFile(file, 'utf8');
    res.statusCode = 200;
    res.setHeader('content-type', 'text/html; charset=utf-8');
    res.setHeader('cache-control', 'no-store');
    res.end(body);
  } catch (err) {
    res.statusCode = 500;
    res.end(err instanceof Error ? err.message : 'error');
  }
}

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
