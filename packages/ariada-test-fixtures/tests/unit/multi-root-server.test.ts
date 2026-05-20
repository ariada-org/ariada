// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Unit tests for the multi-root HTTP fixture server. Covers:
//   - happy path single-root + multi-root file serving
//   - URL builder shape (urlFor with empty + non-empty prefix)
//   - longest-prefix matching when multiple roots share a stem
//   - port range validation (RangeError on out-of-range)
//   - loopback bind (server URL uses 127.0.0.1)
//   - HTML content-type + no-store cache-control on success
//   - 404 path: missing file in mounted root
//   - 404 path: request for `/` when indexFromPrefix is unset
//   - 200 path: HTML index page when indexFromPrefix is set
//   - path-traversal mitigation via listing-only resolution
//   - stop() shuts down cleanly (subsequent requests fail)

import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { connect, type Socket } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { URL } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  startMultiRootHttpServer,
  type MultiRootHttpServerHandle,
} from '../../src/multi-root-server.ts';

/**
 * Issue a raw HTTP/1.1 GET against the given origin, bypassing fetch's
 * client-side URL normalisation. Returns the response status code.
 *
 * Used by the path-traversal test so the literal `..` segments actually
 * reach the server rather than being collapsed by the URL parser.
 */
async function rawGetStatus(origin: string, rawPath: string): Promise<number> {
  const { hostname, port } = new URL(origin);
  return new Promise<number>((resolve, reject) => {
    const socket: Socket = connect({ host: hostname, port: Number(port) });
    let buffer = '';
    socket.on('data', (chunk) => {
      buffer += chunk.toString('utf8');
      if (buffer.length >= 12) {
        const match = /^HTTP\/1\.[01] (\d{3})/.exec(buffer);
        if (match) {
          resolve(Number.parseInt(match[1] ?? '0', 10));
          socket.end();
        }
      }
    });
    socket.on('error', reject);
    socket.on('end', () => {
      if (!buffer) reject(new Error('connection closed before any response'));
    });
    socket.write(`GET ${rawPath} HTTP/1.1\r\nHost: ${hostname}:${port}\r\nConnection: close\r\n\r\n`);
  });
}

interface TempDirs {
  base: string;
  generic: string;
  eu: string;
}

async function makeTempFixtureDirs(): Promise<TempDirs> {
  const base = await mkdtemp(join(tmpdir(), 'multi-root-test-'));
  const generic = join(base, 'generic');
  const eu = join(base, 'eu');
  await mkdir(generic);
  await mkdir(eu);
  await writeFile(join(generic, 'basic.html'), '<!doctype html><title>basic</title>');
  await writeFile(join(generic, 'second.html'), '<!doctype html><title>second</title>');
  await writeFile(join(eu, 'klarna.html'), '<!doctype html><title>klarna</title>');
  await writeFile(join(eu, 'bankid.html'), '<!doctype html><title>bankid</title>');
  // Non-HTML file that must NOT be served.
  await writeFile(join(generic, 'README.md'), '# do not serve');
  return { base, generic, eu };
}

describe('startMultiRootHttpServer', () => {
  let dirs: TempDirs;
  let server: MultiRootHttpServerHandle | undefined;

  beforeEach(async () => {
    dirs = await makeTempFixtureDirs();
    server = undefined;
  });

  afterEach(async () => {
    if (server) await server.stop();
    await rm(dirs.base, { recursive: true, force: true });
  });

  describe('contract shape', () => {
    it('returns origin, urlFor, stop on a single-root config', async () => {
      server = await startMultiRootHttpServer({
        roots: [{ prefix: '', dir: dirs.generic }],
      });
      expect(typeof server.origin).toBe('string');
      expect(typeof server.urlFor).toBe('function');
      expect(typeof server.stop).toBe('function');
    });

    it('binds to 127.0.0.1 (loopback invariant)', async () => {
      server = await startMultiRootHttpServer({
        roots: [{ prefix: '', dir: dirs.generic }],
      });
      expect(server.origin).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
    });

    it('urlFor returns the correct URL for the unprefixed root', async () => {
      server = await startMultiRootHttpServer({
        roots: [{ prefix: '', dir: dirs.generic }],
      });
      expect(server.urlFor('', 'basic.html')).toBe(`${server.origin}/basic.html`);
    });

    it('urlFor returns the correct URL for a prefixed root', async () => {
      server = await startMultiRootHttpServer({
        roots: [{ prefix: 'eu', dir: dirs.eu }],
      });
      expect(server.urlFor('eu', 'klarna.html')).toBe(`${server.origin}/eu/klarna.html`);
    });
  });

  describe('file serving', () => {
    it('serves an HTML file from the unprefixed root', async () => {
      server = await startMultiRootHttpServer({
        roots: [{ prefix: '', dir: dirs.generic }],
      });
      const response = await fetch(server.urlFor('', 'basic.html'));
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe('text/html; charset=utf-8');
      expect(response.headers.get('cache-control')).toBe('no-store');
      expect(await response.text()).toContain('<title>basic</title>');
    });

    it('serves an HTML file from a prefixed root', async () => {
      server = await startMultiRootHttpServer({
        roots: [
          { prefix: '', dir: dirs.generic },
          { prefix: 'eu', dir: dirs.eu },
        ],
      });
      const response = await fetch(server.urlFor('eu', 'klarna.html'));
      expect(response.status).toBe(200);
      expect(await response.text()).toContain('<title>klarna</title>');
    });

    it('returns 404 for a missing file in the unprefixed root', async () => {
      server = await startMultiRootHttpServer({
        roots: [{ prefix: '', dir: dirs.generic }],
      });
      const response = await fetch(`${server.origin}/missing.html`);
      expect(response.status).toBe(404);
      expect(await response.text()).toContain('not found');
    });

    it('returns 404 for a missing file in a prefixed root', async () => {
      server = await startMultiRootHttpServer({
        roots: [
          { prefix: '', dir: dirs.generic },
          { prefix: 'eu', dir: dirs.eu },
        ],
      });
      const response = await fetch(`${server.origin}/eu/missing.html`);
      expect(response.status).toBe(404);
    });

    it('does NOT serve non-HTML files even when present on disk', async () => {
      server = await startMultiRootHttpServer({
        roots: [{ prefix: '', dir: dirs.generic }],
      });
      const response = await fetch(`${server.origin}/README.md`);
      expect(response.status).toBe(404);
      // Symmetry with the «missing file» case — confirm rejection is
      // listing-filter-driven, not a routing miss.
      expect(await response.text()).toContain('not found');
    });

    it('does NOT allow literal `..` segments to escape the mounted root', async () => {
      // Two co-located roots in the same temp base: `dirs.generic` mounted
      // at /, and a sibling directory (`dirs.eu`) containing a klarna.html
      // we DO NOT want served from the generic mount. We send `..` raw via
      // a socket so the path is NOT normalised client-side by fetch().
      server = await startMultiRootHttpServer({
        roots: [{ prefix: '', dir: dirs.generic }],
      });
      const status = await rawGetStatus(server.origin, '/../eu/klarna.html');
      // The listing for the unprefixed root contains 'basic.html' /
      // 'second.html' only. A request for `../eu/klarna.html` (literal,
      // un-normalised) is treated as a basename lookup against that
      // listing and rejected with 404.
      expect(status).toBe(404);
    });

    it('does NOT allow URL-encoded `..` segments to escape the mounted root', async () => {
      server = await startMultiRootHttpServer({
        roots: [{ prefix: '', dir: dirs.generic }],
      });
      // `%2e%2e` is the percent-encoded form of `..`. fetch() preserves
      // it in the path; the server sees the encoded bytes and the
      // listing-based gate refuses to fall through to the parent dir.
      const response = await fetch(`${server.origin}/%2e%2e/eu/klarna.html`);
      expect(response.status).toBe(404);
    });
  });

  describe('multi-root + longest-prefix matching', () => {
    it('routes /eu/<file> to the eu root when both `/` and `eu/` are mounted', async () => {
      server = await startMultiRootHttpServer({
        roots: [
          { prefix: '', dir: dirs.generic },
          { prefix: 'eu', dir: dirs.eu },
        ],
      });
      const responseEu = await fetch(server.urlFor('eu', 'klarna.html'));
      const responseGeneric = await fetch(server.urlFor('', 'basic.html'));
      expect(responseEu.status).toBe(200);
      expect(await responseEu.text()).toContain('<title>klarna</title>');
      expect(responseGeneric.status).toBe(200);
      expect(await responseGeneric.text()).toContain('<title>basic</title>');
    });

    it('returns 404 for /eu/<not-listed> even if file exists in unprefixed root', async () => {
      server = await startMultiRootHttpServer({
        roots: [
          { prefix: '', dir: dirs.generic },
          { prefix: 'eu', dir: dirs.eu },
        ],
      });
      // basic.html exists in generic but NOT in eu — prefix routing must
      // refuse to fall back to the unprefixed root.
      const response = await fetch(`${server.origin}/eu/basic.html`);
      expect(response.status).toBe(404);
    });

    it('normalises prefix by stripping leading + trailing slashes', async () => {
      // `/eu/` should behave identically to `eu` once the server has
      // normalised the config. Routing + urlFor must agree.
      server = await startMultiRootHttpServer({
        roots: [
          { prefix: '', dir: dirs.generic },
          { prefix: '/eu/', dir: dirs.eu },
        ],
      });
      expect(server.urlFor('/eu/', 'klarna.html')).toBe(`${server.origin}/eu/klarna.html`);
      expect(server.urlFor('eu', 'klarna.html')).toBe(`${server.origin}/eu/klarna.html`);
      const response = await fetch(`${server.origin}/eu/klarna.html`);
      expect(response.status).toBe(200);
      expect(await response.text()).toContain('<title>klarna</title>');
    });
  });

  describe('index page', () => {
    it('serves an HTML index of allowed filenames when indexFromPrefix is set', async () => {
      server = await startMultiRootHttpServer({
        roots: [{ prefix: '', dir: dirs.generic }],
        indexFromPrefix: '',
      });
      const response = await fetch(`${server.origin}/`);
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe('text/html; charset=utf-8');
      const body = await response.text();
      expect(body).toContain('basic.html');
      expect(body).toContain('second.html');
      // README.md must NOT appear (filter to .html).
      expect(body).not.toContain('README.md');
    });

    it('returns 404 for / when indexFromPrefix is NOT set', async () => {
      server = await startMultiRootHttpServer({
        roots: [{ prefix: '', dir: dirs.generic }],
      });
      const response = await fetch(`${server.origin}/`);
      expect(response.status).toBe(404);
    });

    it('alphabetises index entries', async () => {
      server = await startMultiRootHttpServer({
        roots: [{ prefix: '', dir: dirs.generic }],
        indexFromPrefix: '',
      });
      const response = await fetch(`${server.origin}/`);
      const body = await response.text();
      // basic.html sorts before second.html.
      expect(body.indexOf('basic.html')).toBeLessThan(body.indexOf('second.html'));
    });
  });

  describe('port validation', () => {
    it('throws RangeError when port is below 0', async () => {
      await expect(
        startMultiRootHttpServer({
          roots: [{ prefix: '', dir: dirs.generic }],
          port: -1,
        }),
      ).rejects.toThrow(RangeError);
    });

    it('throws RangeError when port is above 65535', async () => {
      await expect(
        startMultiRootHttpServer({
          roots: [{ prefix: '', dir: dirs.generic }],
          port: 70000,
        }),
      ).rejects.toThrow(RangeError);
    });

    it('throws RangeError when port is not an integer', async () => {
      await expect(
        startMultiRootHttpServer({
          roots: [{ prefix: '', dir: dirs.generic }],
          port: 1.5,
        }),
      ).rejects.toThrow(RangeError);
    });

    it('accepts port 0 as ephemeral (default behaviour)', async () => {
      server = await startMultiRootHttpServer({
        roots: [{ prefix: '', dir: dirs.generic }],
        port: 0,
      });
      // Ephemeral port assigned by OS.
      const portMatch = /:(\d+)$/.exec(server.origin);
      expect(portMatch).not.toBeNull();
      const portString = portMatch?.[1] ?? '0';
      const port = Number.parseInt(portString, 10);
      expect(port).toBeGreaterThan(0);
      expect(port).toBeLessThanOrEqual(65535);
    });
  });

  describe('stop()', () => {
    it('shuts the server down so subsequent fetches fail', async () => {
      const handle = await startMultiRootHttpServer({
        roots: [{ prefix: '', dir: dirs.generic }],
      });
      await handle.stop();
      // After stop, the server should no longer accept connections. Don't
      // assign to `server` so afterEach doesn't try to stop it again.
      await expect(fetch(handle.urlFor('', 'basic.html'))).rejects.toThrow();
    });
  });
});
