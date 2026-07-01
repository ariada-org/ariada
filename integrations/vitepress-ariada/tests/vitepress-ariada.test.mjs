// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test } from 'node:test';

import {
  buildAriadaCliArgs,
  countFindings,
  runAriadaVitePressScan,
  withAriada,
} from '../dist/index.js';

test('builds the shared Ariada CLI command without local scanner logic', () => {
  const args = buildAriadaCliArgs(
    {
      cliArgs: ['../../packages/ariada-cli/dist/bin.js'],
      domains: ['accessibility', 'privacy'],
      browser: 'firefox',
      severityThreshold: 'serious',
      timeoutMs: 12_000,
    },
    'http://127.0.0.1:4173/',
    '/tmp/ariada-output',
  );

  assert.deepEqual(args, [
    '../../packages/ariada-cli/dist/bin.js',
    'scan',
    'http://127.0.0.1:4173/',
    '--format',
    'both',
    '--output-dir',
    '/tmp/ariada-output',
    '--browser',
    'firefox',
    '--severity-threshold',
    'serious',
    '--timeout-ms',
    '12000',
    '--domains',
    'accessibility,privacy',
  ]);
});

test('maps CLI report findings to a failing VitePress gate', async () => {
  const root = await mkdtemp(join(tmpdir(), 'ariada-vitepress-'));
  try {
    const outDir = join(root, '.vitepress', 'dist');
    const outputDir = join(root, 'ariada-output');
    await mkdir(outDir, { recursive: true });
    await writeFile(join(outDir, 'index.html'), '<main><input name="search"></main>', 'utf8');

    const result = await runAriadaVitePressScan({
      outDir,
      outputDir,
      cliCommand: 'ariada',
      cliArgs: [],
      runner: async (_command, _args) => {
        await mkdir(outputDir, { recursive: true });
        await writeFile(
          join(outputDir, 'multi-domain-report.json'),
          JSON.stringify({
            domains: ['accessibility'],
            grid: {
              'http://127.0.0.1/': {
                accessibility: [
                  {
                    ruleId: 'form-field-name',
                    severity: 'serious',
                    message: 'Form fields need an accessible name.',
                  },
                ],
              },
            },
          }),
          'utf8',
        );
        return { exitCode: 1, stdout: '1 violation', stderr: '' };
      },
    });

    assert.equal(result.gateFailed, true);
    assert.equal(result.runtimeFailed, false);
    assert.equal(result.totalFindings, 1);
    assert.match(result.targetUrl, /^http:\/\/127\.0\.0\.1:\d+\/$/);
    assert.match(result.reportPath ?? '', /multi-domain-report\.json$/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('wraps an existing VitePress buildEnd hook', async () => {
  const root = await mkdtemp(join(tmpdir(), 'ariada-vitepress-build-end-'));
  try {
    const outDir = join(root, '.vitepress', 'dist');
    const outputDir = join(root, 'ariada-output');
    await mkdir(outDir, { recursive: true });
    await writeFile(join(outDir, 'index.html'), '<main>OK</main>', 'utf8');
    let originalCalled = false;

    const config = withAriada(
      {
        async buildEnd() {
          originalCalled = true;
        },
      },
      {
        outDir,
        outputDir,
        failOnViolations: false,
        cliCommand: 'ariada',
        cliArgs: [],
        runner: async () => {
          await mkdir(outputDir, { recursive: true });
          await writeFile(
            join(outputDir, 'scan.json'),
            JSON.stringify({ summary: { total: 0 }, report: { findings: [] } }),
            'utf8',
          );
          return { exitCode: 0, stdout: 'clean', stderr: '' };
        },
      },
    );

    await config.buildEnd?.({ root, outDir });
    assert.equal(originalCalled, true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('counts severities from scan and multi-domain reports at threshold', () => {
  assert.equal(
    countFindings(
      {
        report: {
          findings: {
            page: [
              { severity: 'minor' },
              { severity: 'moderate' },
              { impact: 'critical' },
            ],
          },
        },
      },
      'moderate',
    ),
    2,
  );
});

test('builds a minimal VitePress fixture and scans the generated output with a mocked CLI', async (t) => {
  const command = await firstExecutable([
    resolve('integrations/vitepress-ariada/node_modules/.bin/vitepress'),
    resolve('node_modules/.bin/vitepress'),
  ]);
  if (!command) {
    t.skip('vitepress is not installed in this runner');
    return;
  }

  await run(command, ['build', 'fixtures/site'], { cwd: resolve('integrations/vitepress-ariada') });
  const outputDir = resolve('integrations/vitepress-ariada/test-report/ariada-output');
  const result = await runAriadaVitePressScan({
    outDir: resolve('integrations/vitepress-ariada/fixtures/site/.vitepress/dist'),
    outputDir,
    cliCommand: 'ariada',
    cliArgs: [],
    runner: async () => {
      await mkdir(outputDir, { recursive: true });
      await writeFile(
        join(outputDir, 'multi-domain-report.json'),
        JSON.stringify({
          grid: {
            fixture: {
              accessibility: [{ ruleId: 'image-alt', severity: 'serious' }],
            },
          },
        }),
        'utf8',
      );
      return { exitCode: 1, stdout: 'fixture violation', stderr: '' };
    },
  });

  const html = await readFile(
    resolve('integrations/vitepress-ariada/fixtures/site/.vitepress/dist/index.html'),
    'utf8',
  );
  assert.match(html, /VitePress Ariada Fixture/);
  assert.equal(result.gateFailed, true);
  assert.equal(result.totalFindings, 1);
});

async function firstExecutable(paths) {
  for (const path of paths) {
    try {
      await access(path, constants.X_OK);
      return path;
    } catch {
      // Try the next candidate.
    }
  }
  return null;
}

function run(command, args, options = {}) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, { ...options, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('close', (exitCode) => {
      if (exitCode === 0) resolvePromise({ stdout, stderr });
      else rejectPromise(new Error(`${command} ${args.join(' ')} failed: ${stderr || stdout}`));
    });
    child.on('error', rejectPromise);
  });
}
