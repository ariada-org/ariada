#!/usr/bin/env node
// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { createWebflowScanRequest } from '../src/index.mjs';
import { createFixtureServer, fixtureContext } from './serve-fixture.mjs';

const root = resolve(new URL('..', import.meta.url).pathname);
const logsDir = resolve(root, 'test-report/logs');
const evidenceDir = resolve(root, 'scan-evidence');
const outputDir = resolve(evidenceDir, 'ariada-output');

await mkdir(logsDir, { recursive: true });
await mkdir(outputDir, { recursive: true });

const server = createFixtureServer();
const baseUrl = await listen(server);
let exitCode = 0;
const lines = [`fixture: ${baseUrl}`];

try {
  const contextResponse = await fetch(`${baseUrl}/api/context`);
  const context = await contextResponse.json();
  const scanRequest = createWebflowScanRequest(context);
  const scanResponse = await fetch(`${baseUrl}/api/scan`, {
    body: JSON.stringify(scanRequest),
    headers: { 'content-type': 'application/json' },
    method: 'POST',
  });
  const report = await scanResponse.json();
  lines.push(`context status: ${contextResponse.status}`);
  lines.push(`scan status: ${scanResponse.status}`);
  lines.push(`source: ${report.request.source}`);
  lines.push(`url: ${report.request.url}`);
  lines.push(`findings: ${report.summary.total}`);
  await writeFile(resolve(outputDir, 'webflow-panel-report.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  await writeFile(resolve(evidenceDir, 'command.log'), `${lines.join('\n')}\n`, 'utf8');
  await writeFile(resolve(evidenceDir, 'command.exit'), '0\n', 'utf8');
} catch (error) {
  exitCode = 1;
  lines.push(error instanceof Error ? error.stack : String(error));
  await writeFile(resolve(evidenceDir, 'command.exit'), '1\n', 'utf8');
} finally {
  await writeFile(resolve(logsDir, 'fixture-flow.log'), `${lines.join('\n')}\n`, 'utf8');
  await writeFile(resolve(logsDir, 'fixture-flow.exit'), `${exitCode}\n`, 'utf8');
  await new Promise((resolveClose) => server.close(resolveClose));
}

process.exitCode = exitCode;

function listen(httpServer) {
  return new Promise((resolveListen, reject) => {
    httpServer.once('error', reject);
    httpServer.listen(0, '127.0.0.1', () => {
      const address = httpServer.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      resolveListen(`http://127.0.0.1:${port}`);
    });
  });
}
