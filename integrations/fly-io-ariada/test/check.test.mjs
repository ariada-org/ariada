// SPDX-FileCopyrightText: 2026 Alexander Brichkin (Agonist Development AB)
// SPDX-License-Identifier: EUPL-1.2
//
// The wrapper trusts the scanner's report only after checking that it is the
// report of the scan it asked for. Two agreements are verified, and both are
// the kind of thing that would otherwise pass unnoticed: the exit code in the
// file must match the one the process returned, and the address in the file
// must be the address that was requested. A mismatch means the file on disk is
// from some other run — a stale artifact in a reused directory, say — and
// reporting it would report a scan that did not happen.

import assert from 'node:assert/strict';
import { mkdtemp, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import { runAriadaCheck } from '../dist/check.js';
import { loadConfig } from '../dist/config.js';

const envelope = (over = {}) => ({
  $schema: 'https://ariada.org/schemas/cli-scan.v1.json',
  url: 'https://example.test/',
  durationMs: 12,
  summary: { total: 0, byImpact: { critical: 0, serious: 0, moderate: 0, minor: 0 } },
  report: {},
  exitCode: 0,
  ...over,
});

// Stands in for the scanner: writes the report where the wrapper will look and
// answers with the exit code it was told to.
const runner = (body, exitCode = 0, over = {}) => async (request) => {
  const outputDir = request.args[request.args.indexOf('--output-dir') + 1];
  await writeFile(join(outputDir, 'scan.json'), typeof body === 'string' ? body : JSON.stringify(body));
  return { exitCode, signal: null, stdout: '', stderr: '', ...over };
};

const setup = async (environment = {}) => {
  const cwd = await mkdtemp(join(tmpdir(), 'fly-check-'));
  return loadConfig({ ARIADA_TARGET_URL: 'https://example.test/', ...environment }, cwd);
};

test('a clean scan passes and carries the counts through', async () => {
  const config = await setup();
  const result = await runAriadaCheck(config, { runSubprocess: runner(envelope()) });
  assert.equal(result.status, 'passed');
  assert.equal(result.exitCode, 0);
  assert.equal(result.summary.total, 0);
  assert.equal(result.target.source, 'target-url');
});

test('violations fail the gate, and do not in report-only', async () => {
  const gated = await setup();
  const failing = runner(envelope({ exitCode: 1, summary: { total: 2, byImpact: { critical: 1, serious: 1, moderate: 0, minor: 0 } } }), 1);
  const strict = await runAriadaCheck(gated, { runSubprocess: failing });
  assert.equal(strict.status, 'violations');
  assert.equal(strict.exitCode, 1);

  const lenient = await runAriadaCheck(await setup({ ARIADA_MODE: 'report-only' }), { runSubprocess: failing });
  assert.equal(lenient.status, 'violations');
  assert.equal(lenient.exitCode, 0);
});

test('a report whose exit code disagrees with the process is refused', async () => {
  const config = await setup();
  await assert.rejects(
    runAriadaCheck(config, { runSubprocess: runner(envelope({ exitCode: 1 }), 0) }),
    /does not match report exit/,
  );
});

test('a report about another address is refused', async () => {
  // A stale artifact in a reused directory would otherwise be reported as this
  // run's result, for a page nobody asked about.
  const config = await setup();
  await assert.rejects(
    runAriadaCheck(config, { runSubprocess: runner(envelope({ url: 'https://other.test/' })) }),
    /does not match target/,
  );
});

test('a scanner that died is reported as an error, not as a pass', async () => {
  const config = await setup();
  const result = await runAriadaCheck(config, {
    runSubprocess: async () => ({ exitCode: null, signal: 'SIGKILL', stdout: '', stderr: '' }),
  });
  assert.equal(result.status, 'error');
  assert.equal(result.exitCode, 3);
  assert.equal(result.error.code, 'E_ARIADA_PROCESS');
  assert.deepEqual(result.error.details, { signal: 'SIGKILL' });
});

test("the scanner's own structured error is preferred over a made-up one", async () => {
  const config = await setup();
  const stderr = 'noise\n{"level":"error","code":"E_NAVIGATION","message":"page did not load"}\nmore noise';
  const result = await runAriadaCheck(config, {
    runSubprocess: async () => ({ exitCode: 4, signal: null, stdout: '', stderr }),
  });
  assert.equal(result.error.code, 'E_NAVIGATION');
  assert.equal(result.exitCode, 4);
});

test('a structured line that is not an error is stepped over, not mistaken for one', async () => {
  // The scanner writes other things to its error stream — progress, warnings —
  // and some of them are JSON. Reading the last parseable line rather than the
  // last line that is an error would report a warning as the cause.
  const config = await setup();
  const stderr = [
    '{"level":"error","code":"E_REAL","message":"the actual failure"}',
    '{"level":"info","message":"finished"}',
    '{"code":"E_NO_LEVEL","message":"missing its level"}',
    '{"level":"error","code":42,"message":"code is not a string"}',
  ].join('\n');
  const result = await runAriadaCheck(config, {
    runSubprocess: async () => ({ exitCode: 4, signal: null, stdout: '', stderr }),
  });
  assert.equal(result.error.code, 'E_REAL');
});

test('an unreadable report is a protocol error rather than a crash', async () => {
  const config = await setup();
  await assert.rejects(
    runAriadaCheck(config, { runSubprocess: async () => ({ exitCode: 0, signal: null, stdout: '', stderr: '' }) }),
    /scan.json could not be read/,
  );
});

test('each run gets its own directory, so two runs do not read one another', async () => {
  const config = await setup();
  await runAriadaCheck(config, { runSubprocess: runner(envelope()) });
  await runAriadaCheck(config, { runSubprocess: runner(envelope()) });
  const entries = await readdir(config.outputRoot);
  assert.equal(entries.filter((name) => name.startsWith('run-')).length, 2);
});
