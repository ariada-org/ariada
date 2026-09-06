#!/usr/bin/env node
// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { createWebflowScanRequest, normalizeAriadaFindings, summarizeFindings } from '../src/index.mjs';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const fixtureRoot = resolve(root, 'fixture');

export const fixtureContext = {
  locale: 'en-US',
  pageId: 'page-home',
  pageTitle: 'Home',
  pageUrl: 'https://client.example.test/',
  siteId: 'site-agency-123',
  siteName: 'Client campaign site',
};

export function createFixtureServer() {
  return createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? '/', 'http://127.0.0.1');
      if (request.method === 'GET' && url.pathname === '/api/context') {
        return json(response, fixtureContext);
      }
      if (request.method === 'POST' && url.pathname === '/api/scan') {
        const payload = JSON.parse(await body(request));
        const scanRequest = payload?.source
          ? { ...payload, context: payload.context ?? {} }
          : createWebflowScanRequest(payload);
        const findings = normalizeAriadaFindings(sampleAriadaReport(scanRequest));
        return json(response, {
          findings,
          request: scanRequest,
          scanId: 'webflow-local-fixture-001',
          summary: summarizeFindings(findings),
        });
      }
      const filePath = resolve(fixtureRoot, url.pathname === '/' ? 'index.html' : `.${decodeURIComponent(url.pathname)}`);
      // Compared with the separator, not as a bare prefix: by prefix alone a
      // sibling directory named `fixture-secrets` is "inside" `fixture`, and a
      // request naming it would be served.
      if (filePath !== fixtureRoot && !filePath.startsWith(`${fixtureRoot}${sep}`)) {
        return notFound(response);
      }
      const data = await readFile(filePath);
      response.writeHead(200, { 'content-type': contentType(filePath) });
      response.end(data);
    } catch (error) {
      // The message, never the stack. A stack names absolute paths, module
      // layout and versions, and this answers whoever asked — which for a
      // fixture server run beside a scan is not always the person who started
      // it. The detail belongs in the operator's log, not in the response.
      console.error('fixture server:', error);
      response.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
      response.end('Internal error\n');
    }
  });
}

export function sampleAriadaReport(scanRequest) {
  return {
    findings: [
      {
        message: 'Hero image needs descriptive alternative text before client handoff.',
        ruleId: 'axe/image-alt',
        selector: '.mock-page img.hero',
        severity: 'critical',
      },
      {
        message: 'Call-to-action contrast should be reviewed against WCAG AA before publishing.',
        ruleId: 'axe/color-contrast',
        selector: '.cta',
        severity: 'serious',
      },
    ],
    request: scanRequest,
    scanId: 'webflow-local-fixture-001',
    source: scanRequest.source,
    url: scanRequest.url,
  };
}

function json(response, value) {
  response.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
  response.end(`${JSON.stringify(value, null, 2)}\n`);
}

function notFound(response) {
  response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
  response.end('not found');
}

function body(request) {
  return new Promise((resolveBody, reject) => {
    let data = '';
    request.setEncoding('utf8');
    request.on('data', (chunk) => { data += chunk; });
    request.on('end', () => { resolveBody(data || '{}'); });
    request.on('error', reject);
  });
}

function contentType(path) {
  return {
    '.css': 'text/css; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
  }[extname(path)] ?? 'application/octet-stream';
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT ?? 4871);
  const host = process.env.HOST ?? '127.0.0.1';
  createFixtureServer().listen(port, host, () => {
    console.log(`Ariada Webflow fixture listening at http://${host}:${port}/`);
  });
}
