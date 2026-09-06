// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Recovered from `dist/server.js` and `dist/server.d.ts`. The source this was
// built from was never committed; the compiled output is `tsc` with the types
// stripped, so the shapes come back from the declaration file and the bodies
// are the compiled ones. Checked with
// `bash scripts/sverit-vosstanovlennoe.sh`.
//
// A component's built output is served rather than opened from disk, because a
// file address has a different origin and different rules — module loading,
// fetches, relative links — and a component scanned that way is not the
// component that ships.
//
// THE PATH IS CHECKED BEFORE AND AFTER RESOLVING SYMBOLIC LINKS, and that is the
// point rather than belt and braces. A build output directory routinely contains
// links into a package store; checking the requested name answers a question
// about the name, and the file that gets read is the one at the end of the link.
//
// Every refusal answers with a bare status and nothing else. A static server
// that explains what it refused tells whoever asked which paths exist.
//
// The port is chosen by the operating system, because Bit runs components in
// parallel and a fixed port makes two capsules fight over it.

import { createReadStream } from 'node:fs';
import { realpath, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import type { ServerResponse } from 'node:http';
import { extname, relative, resolve, sep } from 'node:path';

export interface StaticServer {
  origin: string;
  close(): Promise<void>;
}

const CONTENT_TYPES: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm',
};

export async function startStaticServer(rootDirectory: string): Promise<StaticServer> {
  const root = await realpath(rootDirectory);
  const server = createServer((request, response) => {
    void serve(request.method ?? 'GET', request.url ?? '/', root, response);
  });
  server.on('clientError', (_error, socket) => socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n'));
  await new Promise<void>((resolveListen, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject);
      resolveListen();
    });
  });
  const address = server.address();
  if (address === null || typeof address === 'string') {
    server.close();
    throw new Error('Bit Ariada loopback server did not expose a TCP port');
  }
  return {
    origin: `http://127.0.0.1:${address.port}`,
    close: () => new Promise<void>((resolveClose, reject) => {
      server.close((error) => (error === undefined ? resolveClose() : reject(error)));
      server.closeAllConnections();
    }),
  };
}

async function serve(method: string, rawUrl: string, root: string, response: ServerResponse): Promise<void> {
  if (method !== 'GET' && method !== 'HEAD') return reply(response, 405, 'Method not allowed');
  let pathname: string;
  try {
    pathname = decodeURIComponent(new URL(rawUrl, 'http://127.0.0.1').pathname);
  }
  catch {
    return reply(response, 400, 'Bad request');
  }
  if (pathname.includes('\0')) return reply(response, 400, 'Bad request');
  const candidate = resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
  const rel = relative(root, candidate);
  if (rel === '..' || rel.startsWith(`..${sep}`)) return reply(response, 403, 'Forbidden');
  try {
    const realFile = await realpath(candidate);
    const realRel = relative(root, realFile);
    if (realRel === '..' || realRel.startsWith(`..${sep}`)) return reply(response, 403, 'Forbidden');
    const info = await stat(realFile);
    if (!info.isFile()) return reply(response, 404, 'Not found');
    response.statusCode = 200;
    response.setHeader('content-type', CONTENT_TYPES[extname(realFile).toLowerCase()] ?? 'application/octet-stream');
    response.setHeader('content-length', info.size);
    response.setHeader('cache-control', 'no-store');
    response.setHeader('x-content-type-options', 'nosniff');
    if (method === 'HEAD') return void response.end();
    createReadStream(realFile).on('error', () => response.destroy()).pipe(response);
  }
  catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    return reply(response, code === 'ENOENT' ? 404 : 500, code === 'ENOENT' ? 'Not found' : 'Read failure');
  }
}

function reply(response: ServerResponse, status: number, message: string): void {
  response.statusCode = status;
  response.setHeader('content-type', 'text/plain; charset=utf-8');
  response.setHeader('cache-control', 'no-store');
  response.end(`${message}\n`);
}
