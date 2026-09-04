// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';

import {
  buildAriadaCliArgs,
  loadMarvelExport,
  materializeMarvelScanTarget,
  normalizeMarvelExport,
  runMarvelScan,
  validateConfig,
} from '../dist/index.js';

const fixturePath = './fixtures/marvel-prototype-export.json';

test('normalizes recorded Marvel prototype export data', async () => {
  const fixture = await loadMarvelExport({ fixturePath });
  assert.equal(fixture.project.id, 'marvel-prototype-s122');
  assert.equal(fixture.screens.length, 3);
  assert.equal(fixture.screens[0].hotspots[0].label, 'Continue to plan options');
});

test('materializes a browser-readable scan target without scanner logic', async () => {
  const outputDir = await mkdtemp(join(tmpdir(), 'marvel-ariada-'));
  try {
    const fixture = normalizeMarvelExport(JSON.parse(await readFile(fixturePath, 'utf8')));
    const target = await materializeMarvelScanTarget(fixture, join(outputDir, 'target.html'));
    const html = await readFile(target, 'utf8');
    assert.match(html, /Marvel prototype handoff scan target/u);
    assert.match(html, /Checkout rescue prototype/u);
  } finally {
    await rm(outputDir, { recursive: true, force: true });
  }
});

test('builds @ariada-org/cli scan args', () => {
  assert.deepEqual(
    buildAriadaCliArgs('http://127.0.0.1:4173/marvel-scan-target.html', {
      outputDir: './scan-evidence/ariada-output',
      browser: 'chromium',
      format: 'both',
      severityThreshold: 'serious',
      timeoutMs: 1234,
      domains: ['accessibility', 'security'],
    }),
    [
      'scan',
      'http://127.0.0.1:4173/marvel-scan-target.html',
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

test('validates source selection and invokes injected Ariada runner', async () => {
  assert.deepEqual(validateConfig({ fixturePath }), []);
  assert.match(validateConfig({})[0], /fixturePath/u);
  assert.match(validateConfig({ fixturePath, targetUrl: 'https://example.test' })[0], /one Marvel source/u);

  const invocations = [];
  const result = await runMarvelScan(
    {
      fixturePath,
      workDir: './scan-evidence',
      outputDir: './scan-evidence/ariada-output',
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
  assert.match(result.targetUrl, /^http:\/\/127\.0\.0\.1:\d+\/marvel-scan-target\.html$/u);
  assert.equal(invocations.length, 1);
  assert.deepEqual(invocations[0].args.slice(0, 2), ['scan', result.targetUrl]);
});
