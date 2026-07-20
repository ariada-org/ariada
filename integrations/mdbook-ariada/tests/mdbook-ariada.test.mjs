// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable, Writable } from 'node:stream';
import test from 'node:test';

import {
  buildScanCommand,
  runPreprocessor,
  scanMdBookOutput,
  summarizeAriadaReport,
} from '../src/index.mjs';

test('supports the mdBook html renderer handshake only', async () => {
  assert.equal(await runPreprocessor(['supports', 'html']), 0);
  assert.equal(await runPreprocessor(['supports', 'not-html']), 1);
});

test('passes mdBook book content through unchanged', async () => {
  const book = { sections: [{ Chapter: { name: 'Intro', content: '<img>', sub_items: [] } }] };
  const stdin = Readable.from([JSON.stringify([{ renderer: 'html' }, book])]);
  const chunks = [];
  const stdout = new Writable({
    write(chunk, _encoding, callback) {
      chunks.push(Buffer.from(chunk));
      callback();
    },
  });
  const code = await runPreprocessor([], stdin, stdout, new Writable({ write(_c, _e, cb) { cb(); } }));
  assert.equal(code, 0);
  assert.deepEqual(JSON.parse(Buffer.concat(chunks).toString('utf8')), book);
});

test('builds a thin @ariada-org/cli scan invocation for rendered HTML', () => {
  const command = buildScanCommand({
    cliBin: 'ariada',
    targets: ['file:///tmp/book/index.html'],
    outputDir: 'report',
    outputFile: 'report/result.html',
    severityThreshold: 'serious',
    format: 'html',
    domains: 'accessibility',
  });
  assert.deepEqual(command, {
    command: 'ariada',
    args: [
      'scan',
      'file:///tmp/book/index.html',
      '--severity-threshold',
      'serious',
      '--format',
      'html',
      '--output-dir',
      'report',
      '--out',
      'report/result.html',
      '--domains',
      'accessibility',
    ],
  });
});

test('scans every rendered mdBook HTML file through the injected CLI runner', async () => {
  const root = await mkdtemp(join(tmpdir(), 'ariada-mdbook-'));
  try {
    await mkdir(join(root, 'book', 'chapter'), { recursive: true });
    await writeFile(join(root, 'book', 'index.html'), '<h1>Intro</h1>', 'utf8');
    await writeFile(join(root, 'book', 'chapter', 'one.html'), '<img>', 'utf8');
    const seen = [];
    const code = await scanMdBookOutput(
      { bookDir: join(root, 'book'), outputDir: join(root, 'report'), cliBin: 'ariada' },
      async (command) => {
        seen.push(command);
        return 1;
      },
    );
    assert.equal(code, 1);
    assert.equal(seen.length, 1);
    assert.equal(seen[0].command, 'ariada');
    assert.equal(seen[0].args.filter((arg) => arg.startsWith('file:')).length, 2);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('parses Ariada CLI JSON fixture into pass/fail gate state', async () => {
  const fixture = JSON.parse(await readFile(new URL('../fixtures/ariada-scan.json', import.meta.url), 'utf8'));
  assert.deepEqual(summarizeAriadaReport(fixture, 'serious'), {
    total: 2,
    blocking: 1,
    shouldFail: true,
  });
  assert.equal(summarizeAriadaReport(fixture, 'critical').shouldFail, false);
});
