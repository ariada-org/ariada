// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';

import {
  buildAriadaCliArgs,
  findUxpinExportOutput,
  runUxpinScan,
  validateConfig,
} from '../dist/index.js';

const fixtureDir = resolve('fixtures/uxpin-export');

test('discovers a UXPin HTML export folder from export markers', async () => {
  const found = await findUxpinExportOutput(fixtureDir);
  assert.equal(found.entryFile, 'index.html');
  assert.equal(found.dir, fixtureDir);
  assert.ok(found.markers.includes('assets/uxpin-export.json'));
  assert.ok(found.markers.includes('assets/uxpin-preview.js'));
});

test('builds @ariada-org/cli scan args without scanner logic', () => {
  assert.deepEqual(
    buildAriadaCliArgs('http://127.0.0.1:4173/index.html', {
      outputDir: './scan-evidence/ariada-output',
      browser: 'chromium',
      format: 'both',
      severityThreshold: 'serious',
      timeoutMs: 1234,
      domains: ['accessibility', 'security'],
    }),
    [
      'scan',
      'http://127.0.0.1:4173/index.html',
      '--output-dir',
      resolve('./scan-evidence/ariada-output'),
      '--browser',
      'chromium',
      '--format',
      'both',
      '--severity-threshold',
      'serious',
      '--timeout-ms',
      '1234',
      '--domains',
      'accessibility,security',
    ],
  );
});

test('validates recipe config shape', () => {
  assert.deepEqual(validateConfig({ exportDir: './fixtures/uxpin-export' }), []);
  assert.match(validateConfig({})[0], /Set exportDir/u);
  assert.match(
    validateConfig({ exportDir: './fixtures/uxpin-export', targetUrl: 'https://example.test' })[0],
    /either exportDir or targetUrl/u,
  );
  assert.match(validateConfig({ targetUrl: 'file:///tmp/index.html' })[0], /http\(s\)/u);
});

test('serves local UXPin export and invokes injected Ariada CLI runner', async () => {
  const outputDir = await mkdtemp(join(tmpdir(), 'uxpin-ariada-'));
  try {
    const invocations = [];
    const result = await runUxpinScan(
      {
        exportDir: fixtureDir,
        outputDir,
        browser: 'chromium',
        format: 'json',
        severityThreshold: 'critical',
        domains: ['accessibility'],
      },
      {
        cliCommand: 'ariada',
        runner: async (invocation) => {
          invocations.push(invocation);
          return { exitCode: 0, stdout: 'stub ok\n', stderr: '' };
        },
      },
    );

    assert.equal(result.exitCode, 0);
    assert.match(result.targetUrl, /^http:\/\/127\.0\.0\.1:\d+\/index\.html$/u);
    assert.equal(result.servedExportDir, fixtureDir);
    assert.equal(invocations.length, 1);
    assert.equal(invocations[0].command, 'ariada');
    assert.deepEqual(invocations[0].args.slice(0, 2), ['scan', result.targetUrl]);
    assert.ok(invocations[0].args.includes('--domains'));
  } finally {
    await rm(outputDir, { force: true, recursive: true });
  }
});
