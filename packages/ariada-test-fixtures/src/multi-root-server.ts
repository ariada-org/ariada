// SPDX-License-Identifier: EUPL-1.2
/**
 * Multi-root HTTP fixture server — pure Node HTTP, no test-framework
 * dependency. Used by per-package Playwright fixtures to serve curated
 * HTML fixtures over an ephemeral 127.0.0.1:* origin.
 *
 * Two consumer shapes are supported:
 *
 *  - Single-root (one fixture directory served at /<file>.html).
 *  - Multi-root (multiple directories prefix-mounted, e.g.
 *    generic at /<file>.html + EU set at /eu/<file>.html).
 *
 * Per-package Playwright fixtures import {@link startMultiRootHttpServer},
 * wrap the returned handle in a worker-scoped `test.extend(...)` fixture,
 * and optionally adapt the URL builder to a package-local shape.
 */
import { readFile, readdir } from 'node:fs/promises';
import { createServer, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { resolve } from 'node:path';

/**
 * One mounted fixture root. URLs under `<prefix>/<file>.html` resolve to
 * files inside `dir`. An empty `prefix` mounts at the URL root.
 */
export interface FixtureRoot {
  /** URL path prefix without leading/trailing slashes, e.g. 'eu'. Empty = root. */
  readonly prefix: string;
  /** Absolute filesystem path to a directory containing the .html files. */
  readonly dir: string;
}

/**
 * Configuration accepted by {@link startMultiRootHttpServer}.
 */
export interface MultiRootHttpServerOptions {
  readonly roots: readonly FixtureRoot[];
  /**
   * If set, an HTML index page listing all files in the named root prefix
   * will be served at `/`. Use `''` to point at the unprefixed root.
   * If unset, requests to `/` return 404.
   */
  readonly indexFromPrefix?: string;
  /**
   * Optional bind port; defaults to `0` (OS-chosen ephemeral). Loopback
   * `127.0.0.1` is always used as the interface.
   */
  readonly port?: number;
}

/**
 * Handle returned by {@link startMultiRootHttpServer}. The server is
 * stopped via {@link MultiRootHttpServerHandle.stop}.
 */
export interface MultiRootHttpServerHandle {
  /** Origin URL of the running server, e.g. `http://127.0.0.1:54321`. */
  readonly origin: string;
  /**
   * Build a URL for a fixture inside the given root prefix.
   * Pass empty string for the unprefixed root.
   */
  urlFor(prefix: string, name: string): string;
  /** Stop the HTTP server. */
  stop(): Promise<void>;
}

const TEXT_HTML = 'text/html; charset=utf-8';
const TEXT_PLAIN = 'text/plain; charset=utf-8';
const MIN_TCP_PORT = 0;
const MAX_TCP_PORT = 65535;
const LOOPBACK_HOST = '127.0.0.1';

function assertValidPort(port: number): void {
  if (
    !Number.isInteger(port) ||
    port < MIN_TCP_PORT ||
    port > MAX_TCP_PORT
  ) {
    throw new RangeError(
      `startMultiRootHttpServer: opts.port must be a uint16 (${MIN_TCP_PORT}..=${MAX_TCP_PORT}); got ${String(port)}`,
    );
  }
}

async function listHtmlFiles(dir: string): Promise<Set<string>> {
  const entries = await readdir(dir, { withFileTypes: true });
  const out = new Set<string>();
  for (const entry of entries) {
    if (entry.isFile() && entry.name.toLowerCase().endsWith('.html')) {
      out.add(entry.name);
    }
  }
  return out;
}

async function serveFile(res: ServerResponse, file: string): Promise<void> {
  try {
    const body = await readFile(file, 'utf8');
    res.statusCode = 200;
    res.setHeader('content-type', TEXT_HTML);
    res.setHeader('cache-control', 'no-store');
    res.end(body);
  } catch (err) {
    res.statusCode = 500;
    res.end(err instanceof Error ? err.message : 'error');
  }
}

function renderIndexPage(filenames: readonly string[]): string {
  const items = filenames
    .slice()
    .sort((a, b) => a.localeCompare(b))
    .map((name) => `<li><a href="/${name}">${name}</a></li>`)
    .join('');
  return `<!doctype html><html lang="en"><body><h1>Ariada fixtures</h1><ul>${items}</ul></body></html>`;
}

/**
 * Normalise a `FixtureRoot.prefix`: strip surrounding slashes; empty
 * string becomes the unprefixed root. Internal use.
 */
function normalisePrefix(prefix: string): string {
  // Strip leading and trailing slashes without a regex. The previous
  // `/^\/+|\/+$/g` pattern has polynomial backtracking on inputs that are all
  // slashes (the trailing `\/+$` alternative), so we trim by index instead —
  // linear time, no backtracking.
  let start = 0;
  let end = prefix.length;
  while (start < end && prefix.charCodeAt(start) === 47 /* '/' */) start += 1;
  while (end > start && prefix.charCodeAt(end - 1) === 47 /* '/' */) end -= 1;
  return prefix.slice(start, end);
}

/**
 * Start an in-process HTTP server that serves HTML fixtures from one or
 * more directory roots, each mounted at its own URL prefix.
 *
 * The server binds to `127.0.0.1` only (loopback invariant). Requests for
 * `/<prefix>/<file>.html` resolve to files inside the corresponding root's
 * directory; requests for files not present in the root's filesystem
 * listing return HTTP 404. Requests with `..` path components are rejected
 * because the listing is computed from `readdir` at start time (no path
 * traversal possible against unlisted files).
 *
 * @param opts See {@link MultiRootHttpServerOptions}.
 * @returns Handle exposing `origin`, `urlFor`, `stop`.
 */
export async function startMultiRootHttpServer(
  opts: MultiRootHttpServerOptions,
): Promise<MultiRootHttpServerHandle> {
  if (opts.port !== undefined) assertValidPort(opts.port);

  const normalisedRoots = opts.roots.map((r) => ({
    ...r,
    prefix: normalisePrefix(r.prefix),
  }));
  const byPrefix = new Map<string, FixtureRoot>(
    normalisedRoots.map((r) => [r.prefix, r]),
  );
  const listings = new Map<string, Set<string>>();
  await Promise.all(
    normalisedRoots.map(async (r) => {
      listings.set(r.prefix, await listHtmlFiles(r.dir));
    }),
  );

  const indexPrefix =
    opts.indexFromPrefix !== undefined
      ? normalisePrefix(opts.indexFromPrefix)
      : undefined;

  const httpServer: Server = createServer((req, res) => {
    const raw = (req.url ?? '/').split('?')[0] ?? '/';
    // Strip leading slashes by index (linear, no regex backtracking) since
    // `raw` derives from the attacker-controlled request URL.
    let firstNonSlash = 0;
    while (firstNonSlash < raw.length && raw.charCodeAt(firstNonSlash) === 47 /* '/' */) {
      firstNonSlash += 1;
    }
    const trimmed = raw.slice(firstNonSlash);

    if (trimmed === '' || trimmed === '/') {
      if (indexPrefix !== undefined) {
        const listing = listings.get(indexPrefix) ?? new Set<string>();
        const filenames = Array.from(listing);
        res.statusCode = 200;
        res.setHeader('content-type', TEXT_HTML);
        res.end(renderIndexPage(filenames));
        return;
      }
      res.statusCode = 404;
      res.setHeader('content-type', TEXT_PLAIN);
      res.end('index not configured');
      return;
    }

    // Pick the longest matching prefix.
    let matchedPrefix: string | undefined;
    for (const candidate of byPrefix.keys()) {
      if (candidate === '') continue;
      const matchesPrefix =
        trimmed === candidate || trimmed.startsWith(`${candidate}/`);
      const longerThanCurrent =
        matchedPrefix === undefined ||
        candidate.length > matchedPrefix.length;
      if (matchesPrefix && longerThanCurrent) {
        matchedPrefix = candidate;
      }
    }

    const usedPrefix = matchedPrefix ?? '';
    const name =
      usedPrefix === '' ? trimmed : trimmed.slice(usedPrefix.length + 1);
    const root = byPrefix.get(usedPrefix);
    const listing = listings.get(usedPrefix);
    if (!root || !listing || !listing.has(name)) {
      res.statusCode = 404;
      res.setHeader('content-type', TEXT_PLAIN);
      const label = usedPrefix === '' ? 'fixture' : `${usedPrefix} fixture`;
      res.end(`${label} not found: ${name}`);
      return;
    }
    void serveFile(res, resolve(root.dir, name));
  });

  await new Promise<void>((r, rej) => {
    httpServer.once('error', rej);
    httpServer.listen(opts.port ?? 0, LOOPBACK_HOST, r);
  });

  const addr = httpServer.address() as AddressInfo;
  const origin = `http://${LOOPBACK_HOST}:${addr.port}`;

  return {
    origin,
    urlFor(prefix: string, name: string): string {
      const np = normalisePrefix(prefix);
      return np === '' ? `${origin}/${name}` : `${origin}/${np}/${name}`;
    },
    stop(): Promise<void> {
      return new Promise<void>((r, rej) =>
        httpServer.close((error) => {
          if (error) rej(error);
          else r();
        }),
      );
    },
  };
}
