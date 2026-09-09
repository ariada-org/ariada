// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Recovered from `dist/lib/static-server.js` and `dist/lib/static-server.d.ts`.
// The source this was built from was never committed; the compiled output is
// `tsc` with the types stripped, so the shapes come back from the declaration
// file and the bodies are the compiled ones. Checked with
// `bash scripts/sverit-vosstanovlennoe.sh`.
//
// WHY A SERVER AT ALL. A built site is scanned as it will be served, not as it
// sits on disk: opening a file gives a different origin and different rules, so
// what the scanner sees is not what a visitor would.
//
// THE PATH IS CHECKED TWICE, AND THAT IS THE POINT. Once on the resolved
// request, and again on the real path after symbolic links are followed. A
// build output directory can contain a link pointing anywhere, and a check made
// before following it answers a question about a name rather than about a file.
//
// Every failure answers 404 with no detail. A static server that explains why it
// refused tells whoever asked which paths exist.

import { readFile, realpath, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import type { ServerResponse } from 'node:http';
import { extname, isAbsolute, join, relative, resolve } from 'node:path';


export interface StaticServerHandle {
  url: string;
  close(): Promise<void>;
}

const CONTENT_TYPES: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
};

function isInside(root: string, candidate: string): boolean {
  const rel = relative(root, candidate);
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

function respond(response: ServerResponse, status: number, message: string): void {
  response.writeHead(status, {
    'cache-control': 'no-store',
    'content-type': 'text/plain; charset=utf-8',
    'x-content-type-options': 'nosniff',
  });
  response.end(message);
}

export async function serveDirectory(directory: string): Promise<StaticServerHandle> {
  const root = await realpath(directory);
  if (!(await stat(root)).isDirectory())
    throw new Error(`Build output is not a directory: ${directory}`);
  const server = createServer(async (request, response) => {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      respond(response, 405, 'Method not allowed');
      return;
    }
    try {
      const pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://127.0.0.1').pathname);
      if (pathname.includes('\0')) throw new Error('Invalid path');
      let candidate = resolve(root, pathname.replace(/^\/+/, '') || 'index.html');
      if (!isInside(root, candidate)) throw new Error('Path escapes build output');
      const candidateStat = await stat(candidate);
      if (candidateStat.isDirectory()) candidate = join(candidate, 'index.html');
      const canonical = await realpath(candidate);
      if (!isInside(root, canonical)) throw new Error('Symlink escapes build output');
      const body = await readFile(canonical);
      response.writeHead(200, {
        'cache-control': 'no-store',
        'content-length': String(body.byteLength),
        'content-type': CONTENT_TYPES[extname(canonical).toLowerCase()] ?? 'application/octet-stream',
        'x-content-type-options': 'nosniff',
      });
      response.end(request.method === 'HEAD' ? undefined : body);
    } catch {
      respond(response, 404, 'Not found');
    }
  });
  await new Promise<void>((resolveListen, rejectListen) => {
    server.once('error', rejectListen);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', rejectListen);
      resolveListen();
    });
  });
  const address = server.address();
  if (address === null || typeof address === 'string') {
    server.close();
    throw new Error('Loopback server did not expose a TCP port');
  }
  return {
    url: `http://127.0.0.1:${address.port}/`,
    close: () =>
      new Promise<void>((resolveClose, rejectClose) => {
        server.close((error) => (error === undefined ? resolveClose() : rejectClose(error)));
      }),
  };
}
