// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Recovered from `dist/remote/server.js` and its declaration. The source this
// was built from was never committed; the compiled output is `tsc` with the
// types stripped, so the shapes come back from the declaration file and the
// bodies are the compiled ones. Checked with
// `bash scripts/sverit-vosstanovlennoe.sh`.
//
// The request body is read with a ceiling rather than in one call, because the
// size is decided by whoever is calling. Sixteen kilobytes is generous for what
// this endpoint takes — a threshold and nothing else.
//
// Header names are lowered before the handler sees them, so the handler asks for
// one spelling instead of guessing which one arrived.
//
// One address answers a scan and one answers a health check; everything else is
// a plain 404. And every uncaught failure becomes a 400 with the message
// clipped, so a stack trace never leaves this process.

import { createServer } from 'node:http';
import type { IncomingMessage } from 'node:http';

import { handleScanRequest } from './handler.js';


const MAX_REQUEST_BYTES = 16 * 1024;

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > MAX_REQUEST_BYTES) throw new Error('Request body exceeds 16 KiB');
    chunks.push(buffer);
  }
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function requestHeaders(request: IncomingMessage): Record<string, string | string[] | undefined> {
  return Object.fromEntries(Object.entries(request.headers).map(([name, value]) => [name.toLowerCase(), value]));
}

export function startRemoteServer(options: { appId: string; port: number }) {
  const server = createServer((request, response) => {
    void (async () => {
      response.setHeader('cache-control', 'no-store');
      response.setHeader('content-type', 'application/json; charset=utf-8');
      response.setHeader('x-content-type-options', 'nosniff');
      if (request.method === 'GET' && request.url === '/health') {
        response.writeHead(200).end(JSON.stringify({ status: 'ok', service: 'confluence-ariada', version: '0.1.0' }));
        return;
      }
      if (request.method !== 'POST' || request.url !== '/v1/scan') {
        response.writeHead(404).end(JSON.stringify({ code: 'NOT_FOUND', error: 'Not found' }));
        return;
      }
      const result = await handleScanRequest({ headers: requestHeaders(request), body: await readJson(request) }, options.appId);
      response.writeHead(result.status).end(JSON.stringify(result.body));
    })().catch((error) => {
      const message = error instanceof Error ? error.message : 'Invalid request';
      response.writeHead(400).end(JSON.stringify({ code: 'BAD_REQUEST', error: message.slice(0, 300) }));
    });
  });
  server.listen(options.port, '0.0.0.0');
  return server;
}
