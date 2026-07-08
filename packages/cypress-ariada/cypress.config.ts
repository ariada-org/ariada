// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

import { createReadStream } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { join } from 'node:path';

import { defineConfig } from 'cypress';

import { setupAriadaNodeEvents } from './src/plugin.js';

export default defineConfig({
  e2e: {
    specPattern: 'cypress/e2e/**/*.cy.ts',
    supportFile: 'cypress/support/e2e.ts',
    async setupNodeEvents(on, config) {
      const server = await startFixtureServer();
      config.baseUrl = server.url;
      on('after:run', () => server.close());
      return setupAriadaNodeEvents(on, config, {
        async runScan(_url, options) {
          await writeStubScanJson(options.outputDir ?? '.');
          return 1;
        },
      });
    },
  },
});

function startFixtureServer(): Promise<{ url: string; close: () => Promise<void> }> {
  let server: Server;
  return new Promise((resolve, reject) => {
    server = createServer((request, response) => {
      if (request.url === '/bad.html') {
        response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        createReadStream(join(process.cwd(), 'cypress/fixtures/bad.html')).pipe(response);
        return;
      }
      response.writeHead(404).end('not found');
    });
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (address === null || typeof address === 'string') {
        reject(new Error('Unable to allocate Cypress fixture server port'));
        return;
      }
      resolve({
        url: `http://127.0.0.1:${address.port}`,
        close: () =>
          new Promise((closeResolve, closeReject) => {
            server.close((error) => (error ? closeReject(error) : closeResolve()));
          }),
      });
    });
  });
}

async function writeStubScanJson(outputDir: string): Promise<void> {
  const { mkdir, writeFile } = await import('node:fs/promises');
  await mkdir(outputDir, { recursive: true });
  await writeFile(
    join(outputDir, 'scan.json'),
    JSON.stringify({
      summary: { total: 1, byImpact: { critical: 1, serious: 0, moderate: 0, minor: 0 } },
      report: {
        findings: {
          a11y: [
            {
              ruleId: 'button-name',
              severity: 'critical',
              criterion: 'WCAG 4.1.2',
              message: 'Button must have discernible text',
              element: { selector: 'button' },
            },
          ],
        },
      },
    }),
    'utf8',
  );
}
