// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
'use strict';

const assert = require('node:assert/strict');
const { access, mkdir, mkdtemp, rm, writeFile } = require('node:fs/promises');
const { constants } = require('node:fs');
const { spawn } = require('node:child_process');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { test } = require('node:test');

const { runAriadaScan, resolveConfig } = require('../lib/hexo-ariada');

test('integration: generated Hexo public output is handed to the Ariada scan hook', async (t) => {
  const hexoBin = await findExecutable('hexo');
  if (!hexoBin) {
    t.skip('Blocked: Hexo CLI is not installed on this host; install hexo-cli to run the end-to-end host test.');
    return;
  }

  const root = await mkdtemp(join(tmpdir(), 'hexo-ariada-host-'));
  try {
    await mkdir(join(root, 'source', '_posts'), { recursive: true });
    await writeFile(join(root, '_config.yml'), 'title: Ariada Hexo Fixture\n', 'utf8');
    await writeFile(
      join(root, 'source', '_posts', 'a11y.md'),
      [
        '---',
        'title: A11y fixture',
        '---',
        '',
        '<img src="/missing.png">',
        '',
      ].join('\n'),
      'utf8',
    );

    const generated = await run(hexoBin, ['generate'], root);
    assert.equal(generated.exitCode, 0, generated.stderr);

    let targetUrl = '';
    const summary = await runAriadaScan({
      ...resolveConfig({ base_dir: root, config: {} }),
      failOnFindings: false,
      spawnCli: async (_command, args) => {
        targetUrl = args[2];
        return { exitCode: 1, stdout: 'fixture violation', stderr: '' };
      },
    });

    assert.match(targetUrl, /^http:\/\/127\.0\.0\.1:\d+\/$/);
    assert.equal(summary.exitCode, 1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

async function findExecutable(name) {
  for (const dir of (process.env.PATH || '').split(':')) {
    const candidate = join(dir, name);
    try {
      await access(candidate, constants.X_OK);
      return candidate;
    } catch {}
  }
  return null;
}

function run(command, args, cwd) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('error', reject);
    child.on('close', (exitCode) => resolvePromise({ exitCode, stdout, stderr }));
  });
}
