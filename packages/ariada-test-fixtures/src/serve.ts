// SPDX-License-Identifier: EUPL-1.2
import { readFile } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_ROOT = resolve(__dirname, '..', 'fixtures');

const ALLOWED = new Set([
  'basic-pass.html',
  'color-contrast.html',
  'alt-text.html',
  'shadow-dom.html',
  'iframe-nested.html',
  'iframe-child.html',
  'mixed-severity.html',
]);

/**
 *
 */
export interface FixtureServer {
  readonly url: string;
  readonly port: number;
  stop(): Promise<void>;
}

/**
 * Optional configuration for the in-process fixture server.
 *
 * @property port - TCP port to bind. Defaults to `0` (OS-chosen ephemeral
 *   port). Must be a uint16 (`0..=65535`); higher values reject with
 *   `RangeError`. Bind always targets `127.0.0.1` (loopback) — never
 *   `0.0.0.0` (loopback-only bind invariant).
 */
export interface StartFixtureServerOptions {
  readonly port?: number;
}

/**
 * Start the in-process fixture HTTP server. Binds to `127.0.0.1` only
 * (loopback-only bind invariant). Serves the seven allowlisted
 * generic fixtures over `text/html; charset=utf-8` with `cache-control:
 * no-store`. Any other request path returns HTTP 404.
 *
 * @param opts - Optional `{ port }`. Omitted / `0` = OS-chosen ephemeral.
 * @returns `{ url, port, stop }` per the `FixtureServer` schema.
 */
export async function startFixtureServer(
  opts?: StartFixtureServerOptions,
): Promise<FixtureServer> {
  const requestedPort = opts?.port ?? 0;
  if (
    !Number.isInteger(requestedPort) ||
    requestedPort < 0 ||
    requestedPort > 65535
  ) {
    throw new RangeError(
      `startFixtureServer: opts.port must be a uint16 (0..=65535); got ${String(
        requestedPort,
      )}`,
    );
  }

  const server: Server = createServer((req, res) => {
    const raw = (req.url ?? '/').split('?')[0] ?? '/';
    const name = raw === '/' ? 'basic-pass.html' : raw.slice(1);
    if (!ALLOWED.has(name)) {
      res.statusCode = 404;
      res.end('not found');
      return;
    }
    readFile(resolve(FIXTURES_ROOT, name), 'utf8')
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

  await new Promise<void>((r) => server.listen(requestedPort, '127.0.0.1', r));
  const addr = server.address() as AddressInfo;
  const port = addr.port;

  return {
    url: `http://127.0.0.1:${port}`,
    port,
    stop: (): Promise<void> =>
      new Promise((r, rej) =>
        server.close((e) => {
          if (e) rej(e);
          else r();
        }),
      ),
  };
}