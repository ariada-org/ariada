// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';

import {
  buildAriadaCliArgs,
  inspectProtoPieBundle,
  runProtoPieScan,
  summarizeStaticSurface,
  validateConfig,
} from '../dist/index.js';

const bundleDir = resolve('fixtures/protopie-prototype');
const hostDir = resolve('fixtures/protopie-cloud-player');

test('discovers ProtoPie .pie and scene metadata fixture markers', async () => {
  const bundle = await inspectProtoPieBundle(bundleDir);
  assert.equal(bundle.dir, bundleDir);
  assert.ok(bundle.pieFile?.endsWith('ariada-kiosk.pie'));
  assert.ok(bundle.markers.includes('.pie bundle marker'));
  assert.equal(bundle.scenes.length, 2);
  assert.equal(bundle.scenes[0].name, 'Welcome kiosk');
});

test('summarizes static layer surface without implementing accessibility rules', async () => {
  const bundle = await inspectProtoPieBundle(bundleDir);
  assert.deepEqual(summarizeStaticSurface(bundle), [
    'Welcome kiosk: 7 visible layers, 3 text/input layers, 1 target-size candidates',
    'Payment confirm: 5 visible layers, 2 text/input layers, 1 target-size candidates',
  ]);
});

test('builds @ariada-org/cli scan args and leaves scanning to shared CLI', () => {
  assert.deepEqual(
    buildAriadaCliArgs('http://127.0.0.1:4173/index.html', {
      outputDir: './scan-evidence/ariada-output',
      browser: 'chromium',
      format: 'both',
      severityThreshold: 'serious',
      timeoutMs: 1234,
      domains: ['accessibility', 'privacy'],
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
      'accessibility,privacy',
    ],
  );
});

test('validates recipe config shape and ProtoPie Cloud URL requirements', () => {
  assert.deepEqual(validateConfig({ hostDir }), []);
  assert.deepEqual(validateConfig({ targetUrl: 'https://cloud.protopie.io/p/example' }), []);
  assert.match(validateConfig({})[0], /Set targetUrl/u);
  assert.match(validateConfig({ hostDir, targetUrl: 'https://cloud.protopie.io/p/example' })[0], /either targetUrl or hostDir/u);
  assert.match(validateConfig({ targetUrl: 'file:///tmp/index.html' })[0], /http\(s\)/u);
});

test('serves local ProtoPie host fixture and invokes injected Ariada CLI runner', async () => {
  const outputDir = await mkdtemp(join(tmpdir(), 'protopie-ariada-'));
  try {
    const invocations = [];
    const result = await runProtoPieScan(
      {
        pieBundleDir: bundleDir,
        hostDir,
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
    assert.equal(result.servedHostDir, hostDir);
    assert.equal(result.bundle?.scenes.length, 2);
    assert.equal(invocations.length, 1);
    assert.equal(invocations[0].command, 'ariada');
    assert.deepEqual(invocations[0].args.slice(0, 2), ['scan', result.targetUrl]);
  } finally {
    await rm(outputDir, { force: true, recursive: true });
  }
});
