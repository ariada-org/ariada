// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
'use strict';

const assert = require('node:assert/strict');
const { mkdir, mkdtemp, rm, writeFile } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { test } = require('node:test');

const {
  buildCliArgs,
  countFindings,
  createStaticServer,
  registerHexoAriada,
  resolveConfig,
  runAriadaScan,
} = require('../lib/hexo-ariada');

test('registers a Hexo after_generate filter', async () => {
  let hook;
  const hexo = {
    base_dir: process.cwd(),
    config: { ariada: { enabled: true } },
    extend: {
      filter: {
        register(name, callback) {
          assert.equal(name, 'after_generate');
          hook = callback;
        },
      },
    },
    log: { info() {}, warn() {} },
  };

  registerHexoAriada(hexo, {
    publicDir: '.',
    spawnCli: () => Promise.resolve({ exitCode: 0, stdout: '', stderr: '' }),
  });

  assert.equal(typeof hook, 'function');
});

test('builds the shared Ariada CLI invocation for a loopback preview URL', () => {
  const args = buildCliArgs('http://127.0.0.1:4111/', {
    browser: 'chromium',
    domains: 'accessibility',
    outputDir: '/tmp/ariada-output',
    severityThreshold: 'serious',
    timeoutMs: 1000,
  });

  assert.deepEqual(args.slice(0, 4), ['@ariada-org/cli', 'scan', 'http://127.0.0.1:4111/', '--allow-private']);
  assert.ok(args.includes('--domains'));
  assert.ok(args.includes('accessibility'));
  assert.ok(args.includes('--output-dir'));
  assert.ok(args.includes('/tmp/ariada-output'));
});

test('runs the CLI against generated public output and counts findings', async () => {
  const root = await mkdtemp(join(tmpdir(), 'hexo-ariada-'));
  try {
    await mkdir(join(root, 'public'), { recursive: true });
    await writeFile(join(root, 'public', 'index.html'), '<main><img src="x.png"></main>', 'utf8');
    await mkdir(join(root, 'ariada-output'), { recursive: true });
    await writeFile(
      join(root, 'ariada-output', 'multi-domain-report.json'),
      JSON.stringify({
        sites: ['fixture'],
        domains: ['accessibility'],
        grid: { fixture: { accessibility: [{ severity: 'serious' }] } },
      }),
      'utf8',
    );

    const seen = {};
    const summary = await runAriadaScan({
      ...resolveConfig({ base_dir: root, config: {} }),
      failOnFindings: false,
      spawnCli: async (command, args, options) => {
        seen.command = command;
        seen.args = args;
        seen.cwd = options.cwd;
        return { exitCode: 1, stdout: 'Wrote report', stderr: '' };
      },
    });

    assert.equal(seen.command, 'npx');
    assert.equal(seen.cwd, root);
    assert.match(seen.args[2], /^http:\/\/127\.0\.0\.1:\d+\/$/);
    assert.equal(summary.findingCount, 1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('fails the Hexo gate when Ariada exits non-zero and failOnFindings is enabled', async () => {
  const root = await mkdtemp(join(tmpdir(), 'hexo-ariada-fail-'));
  try {
    await mkdir(join(root, 'public'), { recursive: true });
    await writeFile(join(root, 'public', 'index.html'), '<input>', 'utf8');

    await assert.rejects(
      runAriadaScan({
        ...resolveConfig({ base_dir: root, config: {} }),
        spawnCli: async () => ({ exitCode: 1, stdout: '', stderr: 'violations' }),
      }),
      /Ariada CLI exited with code 1/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('serves generated HTML from the public directory', async () => {
  const root = await mkdtemp(join(tmpdir(), 'hexo-ariada-server-'));
  try {
    await writeFile(join(root, 'index.html'), '<h1>Hexo fixture</h1>', 'utf8');
    const server = await createStaticServer(root, 0);
    try {
      const response = await fetch(server.url);
      assert.equal(response.status, 200);
      assert.match(await response.text(), /Hexo fixture/);
    } finally {
      await server.close();
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('counts findings from a multi-domain report fixture', async () => {
  const root = await mkdtemp(join(tmpdir(), 'hexo-ariada-report-'));
  try {
    const reportPath = join(root, 'multi-domain-report.json');
    await writeFile(
      reportPath,
      JSON.stringify({
        sites: ['a', 'b'],
        domains: ['accessibility'],
        grid: {
          a: { accessibility: [{}, {}] },
          b: { accessibility: [{}] },
        },
      }),
      'utf8',
    );

    assert.equal(await countFindings(reportPath), 3);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
