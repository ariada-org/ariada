// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

// The original had no tests, or none that survived. These are written against
// the behaviour the recovered package describes, and they are the reason to
// believe the recovery is faithful: each one states something the compiled
// output does, and each fails if the reconstruction got it wrong.
//
// The scanner itself is never started. What is exercised is everything around
// it — which address is chosen, what is refused, and whether the report agrees
// with the run that produced it.

import { strict as assert } from 'node:assert';
import { mkdtemp, readFile, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  AzureSwaAriadaError,
  parseAriadaScanJson,
  resolveBuildOutput,
  resolvePreviewUrl,
  runAzureSwaAriada,
} from '../dist/index.js';
import { parseCliArgs, parseConfigJson } from '../dist/cli.js';

const SCHEMA = 'https://ariada.org/schemas/cli-scan.v1.json';

function scanJson(overrides = {}) {
  return JSON.stringify({
    $schema: SCHEMA,
    url: 'https://example.azurestaticapps.net/',
    startedAt: '2026-09-02T09:00:00.000Z',
    completedAt: '2026-09-02T09:00:04.000Z',
    durationMs: 4000,
    summary: { total: 0, byImpact: { critical: 0, serious: 0, moderate: 0, minor: 0 } },
    report: {},
    exitCode: 0,
    ...overrides,
  });
}

test('an explicit address beats every variable the host might set', () => {
  const env = {
    SWA_PREVIEW_URL: 'https://from-swa.example/',
    STATIC_WEB_APP_URL: 'https://from-static.example/',
  };
  assert.equal(resolvePreviewUrl('https://explicit.example/', env), 'https://explicit.example/');
  assert.equal(resolvePreviewUrl(undefined, env), 'https://from-swa.example/');
  assert.equal(resolvePreviewUrl(undefined, { STATIC_WEB_APP_URL: 'https://third.example/' }), 'https://third.example/');
});

test('an address with credentials in it is refused rather than cleaned', () => {
  // Cleaned, they would be gone from the report and still in whatever set them.
  assert.throws(
    () => resolvePreviewUrl('https://user:secret@example.net/', {}),
    (error) => error instanceof AzureSwaAriadaError && /Credentials/u.test(error.message),
  );
});

test('an address that is not a web address is refused', () => {
  assert.throws(() => resolvePreviewUrl('file:///etc/hosts', {}), /http or https/u);
  assert.throws(() => resolvePreviewUrl('not a url', {}), /invalid/u);
  assert.throws(() => resolvePreviewUrl(undefined, {}), /No Static Web Apps URL/u);
});

test('the output directory follows the runner it is on', () => {
  const cwd = '/work';
  assert.equal(resolveBuildOutput('out', {}, cwd), '/work/out');
  assert.equal(
    resolveBuildOutput(undefined, { BUILD_ARTIFACTSTAGINGDIRECTORY: '/agent/a' }, cwd),
    '/agent/a/azure-swa-ariada',
  );
  assert.equal(resolveBuildOutput(undefined, { RUNNER_TEMP: '/tmp/r' }, cwd), '/tmp/r/azure-swa-ariada');
  assert.equal(resolveBuildOutput(undefined, {}, cwd), '/work/ariada-output');
});

test('a scanner answer of the wrong shape stops here', () => {
  assert.throws(() => parseAriadaScanJson('{'), /not valid JSON/u);
  assert.throws(() => parseAriadaScanJson(scanJson({ $schema: 'v2' })), /Unsupported Ariada scan schema/u);
  assert.throws(() => parseAriadaScanJson(scanJson({ exitCode: 2 })), /exitCode must be 0 or 1/u);
  assert.throws(() => parseAriadaScanJson(scanJson({ startedAt: 'yesterday' })), /ISO date strings/u);
  assert.throws(() => parseAriadaScanJson(scanJson({ summary: { total: 1 } })), /byImpact is missing/u);
});

test('a setting nobody recognises is refused, not ignored', () => {
  // Ignored, a misspelled key looks exactly like a key that had no effect.
  assert.throws(() => parseConfigJson('{"prevewUrl":"https://x.example/"}'), /Unknown configuration key: prevewUrl/u);
  assert.deepEqual(parseConfigJson('{"mode":"gate"}'), { mode: 'gate' });
});

test('a flag that swallowed the next flag is refused', () => {
  assert.throws(() => parseCliArgs(['--preview-url', '--mode']), /--preview-url requires a value/u);
  assert.throws(() => parseCliArgs(['--mode', 'maybe']), /--mode must be one of/u);
  assert.throws(() => parseCliArgs(['--timeout-ms', '-5']), /positive integer/u);
  assert.deepEqual(parseCliArgs(['--mode', 'gate', '--browser', 'webkit']), { mode: 'gate', browser: 'webkit' });
});

test('a clean scan passes, and the report says where everything came from', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'azure-swa-'));
  try {
    const result = await runAzureSwaAriada(
      { previewUrl: 'https://example.azurestaticapps.net/', buildOutput: dir, cwd: dir },
      {
        runCommand: async (invocation) => {
          const outputDir = invocation.args[invocation.args.indexOf('--output-dir') + 1];
          await mkdir(outputDir, { recursive: true });
          await writeFile(join(outputDir, 'scan.json'), scanJson());
          return { exitCode: 0, signal: null, stdout: '', stderr: '' };
        },
        now: () => new Date('2026-09-02T09:00:05.000Z'),
      },
    );

    assert.equal(result.status, 'passed');
    assert.equal(result.blocked, false);
    assert.equal(result.exitCode, 0);
    assert.equal(result.integration, '@ariada-integrations/azure-swa-ariada');
    const written = JSON.parse(await readFile(result.reportPath, 'utf8'));
    assert.deepEqual(written.summary, result.summary);
  } finally {
    await rm(dir, { force: true, recursive: true });
  }
});

test('crossing the threshold reports in one mode and blocks in the other', async () => {
  const run = async (mode) => {
    const dir = await mkdtemp(join(tmpdir(), 'azure-swa-'));
    try {
      return await runAzureSwaAriada(
        { previewUrl: 'https://example.azurestaticapps.net/', buildOutput: dir, cwd: dir, mode },
        {
          runCommand: async (invocation) => {
            const outputDir = invocation.args[invocation.args.indexOf('--output-dir') + 1];
            await mkdir(outputDir, { recursive: true });
            await writeFile(
              join(outputDir, 'scan.json'),
              scanJson({
                exitCode: 1,
                summary: { total: 3, byImpact: { critical: 1, serious: 0, moderate: 2, minor: 0 } },
              }),
            );
            return { exitCode: 1, signal: null, stdout: '', stderr: '' };
          },
        },
      );
    } finally {
      await rm(dir, { force: true, recursive: true });
    }
  };

  const reported = await run('report');
  assert.equal(reported.status, 'reported');
  assert.equal(reported.blocked, false);
  assert.equal(reported.exitCode, 0);

  const blocked = await run('gate');
  assert.equal(blocked.status, 'blocked');
  assert.equal(blocked.blocked, true);
  assert.equal(blocked.exitCode, 1);
});

test('a report about a different address is refused', async () => {
  // The failure this exists for: a stale scan.json left in the output directory
  // would otherwise be read as this run's answer.
  const dir = await mkdtemp(join(tmpdir(), 'azure-swa-'));
  try {
    await assert.rejects(
      runAzureSwaAriada(
        { previewUrl: 'https://asked-for.example/', buildOutput: dir, cwd: dir },
        {
          runCommand: async (invocation) => {
            const outputDir = invocation.args[invocation.args.indexOf('--output-dir') + 1];
            await mkdir(outputDir, { recursive: true });
            await writeFile(join(outputDir, 'scan.json'), scanJson());
            return { exitCode: 0, signal: null, stdout: '', stderr: '' };
          },
        },
      ),
      /does not match the requested/u,
    );
  } finally {
    await rm(dir, { force: true, recursive: true });
  }
});

test('a process and a file that disagree about how it ended are refused', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'azure-swa-'));
  try {
    await assert.rejects(
      runAzureSwaAriada(
        { previewUrl: 'https://example.azurestaticapps.net/', buildOutput: dir, cwd: dir },
        {
          runCommand: async (invocation) => {
            const outputDir = invocation.args[invocation.args.indexOf('--output-dir') + 1];
            await mkdir(outputDir, { recursive: true });
            await writeFile(join(outputDir, 'scan.json'), scanJson({ exitCode: 1 }));
            return { exitCode: 0, signal: null, stdout: '', stderr: '' };
          },
        },
      ),
      /exit codes do not match/u,
    );
  } finally {
    await rm(dir, { force: true, recursive: true });
  }
});

test('a scanner killed by a signal is not a verdict', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'azure-swa-'));
  try {
    await assert.rejects(
      runAzureSwaAriada(
        { previewUrl: 'https://example.azurestaticapps.net/', buildOutput: dir, cwd: dir },
        { runCommand: async () => ({ exitCode: null, signal: 'SIGKILL', stdout: '', stderr: 'killed' }) },
      ),
      /did not complete a valid scan/u,
    );
  } finally {
    await rm(dir, { force: true, recursive: true });
  }
});
