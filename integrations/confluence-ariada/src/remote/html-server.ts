// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Recovered from `dist/remote/html-server.js` and its declaration. The source
// this was built from was never committed; the compiled output is `tsc` with the
// types stripped, so the shapes come back from the declaration file and the
// bodies are the compiled ones. Checked with
// the rebuild check.
//
// The exported body is wrapped in a document rather than scanned as a fragment,
// because half of what an accessibility scan asks about belongs to the document:
// the language, the title, the single main landmark. A fragment would report
// their absence as findings the page does not have.
//
// The base address is the page's own, so a relative link in the body resolves
// where it would on the real site rather than against a loopback port.
//
// Scripts are refused outright in the declared policy. This document is exported
// markup from somewhere else, and the point is to look at it, not to run it.

import { createServer } from 'node:http';

import type { PageDescriptor } from '../shared/types.js';

function escape(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

export function renderDocument(page: PageDescriptor, body: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><base href="${escape(page.url)}"><title>${escape(page.title)}</title></head><body><main id="confluence-page-body">${body}</main></body></html>`;
}

export async function serveDocument(document: string): Promise<{ url: string; close(): Promise<void> }> {
  const server = createServer((request, response) => {
    if ((request.method !== 'GET' && request.method !== 'HEAD') || request.url !== '/') {
      response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('Not found');
      return;
    }
    response.writeHead(200, {
      'cache-control': 'no-store',
      'content-type': 'text/html; charset=utf-8',
      'content-security-policy': "default-src https: data: blob: 'unsafe-inline'; script-src 'none'; object-src 'none'",
      'x-content-type-options': 'nosniff',
    });
    response.end(request.method === 'HEAD' ? undefined : document);
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve());
  });
  const address = server.address() as { port: number };
  return {
    url: `http://127.0.0.1:${address.port}/`,
    close: () => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())),
  };
}
