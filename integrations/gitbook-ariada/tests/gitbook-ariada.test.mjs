// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';

import {
  buildAriadaInvocation,
  summarizeScanEnvelope,
} from '../src/config.mjs';

test('builds the default @ariada-org/cli URL invocation', () => {
  const invocation = buildAriadaInvocation({
    targetUrl: 'https://docs.example.com',
    reportDir: 'reports/gitbook',
    severity: 'critical',
    format: 'json',
    timeoutMs: 12_000,
  });

  assert.equal(invocation.command, 'npx');
  assert.deepEqual(invocation.args, [
    '@ariada-org/cli',
    'scan',
    'https://docs.example.com',
    '--severity-threshold',
    'critical',
    '--format',
    'json',
    '--output-dir',
    'reports/gitbook',
    '--timeout-ms',
    '12000',
  ]);
});

test('parses CLI JSON fixtures into pass/fail gate summaries', async () => {
  const payload = JSON.parse(
    await readFile(new URL('../fixtures/scan-with-finding.json', import.meta.url), 'utf8'),
  );
  const summary = summarizeScanEnvelope(payload, 'serious');

  assert.equal(summary.total, 1);
  assert.equal(summary.counts.serious, 1);
  assert.equal(summary.failed, true);
  assert.equal(summary.findings[0].ruleId, 'image-alt');
});

test('runs the wrapper against an exported GitBook HTML fixture boundary', async () => {
  const reportDir = await mkdtemp(join(tmpdir(), 'gitbook-ariada-'));
  try {
    const result = spawnSync(
      process.execPath,
      [
        resolve('scripts/gitbook-ariada.mjs'),
        '--target',
        resolve('fixtures/export'),
        '--report-dir',
        reportDir,
        '--cli',
        resolve('tests/fixtures/fake-ariada.mjs'),
        '--format',
        'json',
      ],
      {
        cwd: new URL('..', import.meta.url),
        encoding: 'utf8',
      },
    );

    assert.equal(result.status, 1, result.stderr || result.stdout);
    assert.match(result.stdout, /GitBook Ariada: serving exported HTML/);
    assert.match(result.stdout, /image-alt \[serious\]/);

    const scan = JSON.parse(await readFile(join(reportDir, 'scan.json'), 'utf8'));
    assert.equal(scan.report.findings[0].message, 'GitBook export fixture image is missing alt text.');
  } finally {
    await rm(reportDir, { recursive: true, force: true });
  }
});
