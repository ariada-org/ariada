// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';

import {
  buildAriadaArgs,
  countFindings,
  findEntryHtml,
  parseArgs,
  runScanAgainstBuiltSite,
} from '../src/index.mjs';

test('parseArgs points at Zola public output by default', () => {
  const options = parseArgs([]);
  assert.equal(options.targetDir, 'public');
  assert.equal(options.ariadaCommand, 'npx');
  assert.deepEqual(options.ariadaCommandArgs, ['-y', '@ariada-org/cli']);
  assert.match(options.domains, /accessibility/);
});

test('buildAriadaArgs delegates scanning to @ariada-org/cli', () => {
  const options = parseArgs(['--output-dir', 'scan-evidence/ariada-output', '--domains', 'accessibility,privacy']);
  const args = buildAriadaArgs(options, 'http://127.0.0.1:9999/index.html');
  assert.deepEqual(args.slice(0, 4), ['-y', '@ariada-org/cli', 'scan', 'http://127.0.0.1:9999/index.html']);
  assert.equal(args.includes('--output-dir'), true);
  assert.equal(args.includes('--domains'), true);
});

test('countFindings respects severity thresholds across Ariada JSON shapes', () => {
  const report = {
    summary: { total: 3 },
    grid: {
      site: {
        accessibility: [{ severity: 'moderate' }, { severity: 'serious' }],
        privacy: [{ severity: 'minor' }],
      },
    },
    report: { findings: [{ impact: 'critical' }] },
  };
  assert.equal(countFindings(report, 'moderate'), 3);
  assert.equal(countFindings(report, 'serious'), 2);
  assert.equal(countFindings(report, 'critical'), 1);
});

test('findEntryHtml prefers index.html in a rendered Zola public fixture', () => {
  const root = mkdtempSync(join(tmpdir(), 'zola-ariada-'));
  mkdirSync(join(root, 'public'), { recursive: true });
  writeFileSync(join(root, 'public', 'index.html'), '<main>fixture</main>');
  assert.equal(findEntryHtml(join(root, 'public')), join(root, 'public', 'index.html'));
});

test('runScanAgainstBuiltSite serves the fixture and maps report findings to a failing gate', async () => {
  const root = mkdtempSync(join(tmpdir(), 'zola-ariada-'));
  const publicDir = join(root, 'public');
  const outputDir = join(root, 'ariada-output');
  mkdirSync(publicDir, { recursive: true });
  mkdirSync(outputDir, { recursive: true });
  writeFileSync(join(publicDir, 'index.html'), '<main><img src="hero.png"><button></button></main>');

  const result = await runScanAgainstBuiltSite(
    parseArgs(['--target-dir', publicDir, '--output-dir', outputDir, '--ariada-command', 'mock-ariada']),
    async (_command, args) => {
      assert.equal(args[0], 'scan');
      assert.match(args[1], /^http:\/\/127\.0\.0\.1:/);
      writeFileSync(
        join(outputDir, 'multi-domain-report.json'),
        JSON.stringify({ grid: { fixture: { accessibility: [{ severity: 'serious', rule: 'image-alt' }] } } }),
      );
      return { exitCode: 1, stdout: 'mock finding', stderr: '' };
    },
  );

  assert.equal(result.gateFailed, true);
  assert.equal(result.totalFindings, 1);
  assert.match(result.targetUrl, /index\.html$/);
});

const zolaPath = spawnSync('sh', ['-c', 'command -v zola'], { encoding: 'utf8' }).stdout.trim();

test(
  'integration: zola build output is scanned when the host zola binary is available',
  { skip: zolaPath ? false : 'blocked: zola binary is not installed in this runner' },
  async () => {
    const root = mkdtempSync(join(tmpdir(), 'zola-ariada-build-'));
    const source = resolve(dirname(new URL(import.meta.url).pathname), '..', 'examples', 'site');
    const publicDir = join(root, 'public');
    const outputDir = join(root, 'ariada-output');
    mkdirSync(outputDir, { recursive: true });

    const build = spawnSync(
      zolaPath,
      ['--root', source, 'build', '--output-dir', publicDir, '--force'],
      { encoding: 'utf8' },
    );
    assert.equal(build.status, 0, build.stderr || build.stdout);
    assert.equal(existsSync(join(publicDir, 'index.html')), true);

    const result = await runScanAgainstBuiltSite(
      parseArgs(['--target-dir', publicDir, '--output-dir', outputDir, '--ariada-command', 'mock-ariada']),
      async (_command, args) => {
        assert.equal(args[0], 'scan');
        writeFileSync(
          join(outputDir, 'multi-domain-report.json'),
          JSON.stringify({ grid: { zola: { accessibility: [{ severity: 'serious', rule: 'image-alt' }] } } }),
        );
        return { exitCode: 1, stdout: 'mock finding', stderr: '' };
      },
    );

    assert.equal(result.gateFailed, true);
    assert.equal(result.totalFindings, 1);
  },
);
