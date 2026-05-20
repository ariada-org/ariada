// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Writable } from 'node:stream';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import {
  EXIT_OK,
  EXIT_VIOLATIONS,
  EXIT_INVALID_ARGS,
  EXIT_RUNTIME_ERROR,
} from '../src/exit-codes.js';
import { runScan } from '../src/subcommands/scan.js';

function buffers(): {
  stdout: Writable;
  stderr: Writable;
  out: () => string;
  err: () => string;
} {
  const outChunks: Buffer[] = [];
  const errChunks: Buffer[] = [];
  return {
    stdout: new Writable({
      write(chunk: Buffer, _enc, cb) {
        outChunks.push(chunk);
        cb();
      },
    }),
    stderr: new Writable({
      write(chunk: Buffer, _enc, cb) {
        errChunks.push(chunk);
        cb();
      },
    }),
    out: () => Buffer.concat(outChunks).toString('utf8'),
    err: () => Buffer.concat(errChunks).toString('utf8'),
  };
}

describe('runScan — argument validation (no Playwright)', () => {
  it('returns EXIT_INVALID_ARGS for missing URL', async () => {
    const { stdout, stderr, err } = buffers();
    const code = await runScan(undefined, {}, stdout, stderr, async () => ({ report: {} }));
    expect(code).toBe(EXIT_INVALID_ARGS);
    expect(err()).toMatch(/E_INVALID_OPTION/);
  });

  it('returns EXIT_INVALID_ARGS for non-http URL', async () => {
    const { stdout, stderr, err } = buffers();
    const code = await runScan(
      'ftp://example.com',
      {},
      stdout,
      stderr,
      async () => ({ report: {} }),
    );
    expect(code).toBe(EXIT_INVALID_ARGS);
    expect(err()).toMatch(/E_INVALID_URL/);
  });

  it('returns EXIT_INVALID_ARGS for unknown --browser', async () => {
    const { stdout, stderr, err } = buffers();
    const code = await runScan(
      'https://example.com',
      { browser: 'safari' as 'chromium' },
      stdout,
      stderr,
      async () => ({ report: {} }),
    );
    expect(code).toBe(EXIT_INVALID_ARGS);
    expect(err()).toMatch(/E_INVALID_OPTION/);
  });
});

describe('runScan — happy path with injected stub', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'ariada-cli-test-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('returns EXIT_OK when stub reports no findings', async () => {
    const { stdout, stderr, out } = buffers();
    const code = await runScan(
      'https://example.com',
      { format: 'human' },
      stdout,
      stderr,
      async () => ({ report: { scanId: 'TEST01', url: 'https://example.com', findings: {} } }),
    );
    expect(code).toBe(EXIT_OK);
    expect(out()).toMatch(/0 violations/);
  });

  it('returns EXIT_VIOLATIONS when stub reports a serious finding', async () => {
    const { stdout, stderr, out } = buffers();
    const code = await runScan(
      'https://example.com',
      { format: 'human', severityThreshold: 'moderate' },
      stdout,
      stderr,
      async () => ({
        report: {
          scanId: 'TEST02',
          url: 'https://example.com',
          findings: {
            a11y: [
              {
                ruleId: 'wcag-22-1-3-1',
                severity: 'serious',
                message: 'missing form label',
              },
            ],
          },
        },
      }),
    );
    expect(code).toBe(EXIT_VIOLATIONS);
    expect(out()).toMatch(/1 violation/);
    expect(out()).toMatch(/wcag-22-1-3-1/);
  });

  it('honours --severity-threshold critical (filters out serious)', async () => {
    const { stdout, stderr } = buffers();
    const code = await runScan(
      'https://example.com',
      { format: 'human', severityThreshold: 'critical' },
      stdout,
      stderr,
      async () => ({
        report: {
          findings: { a11y: [{ ruleId: 'x', severity: 'serious', message: 'm' }] },
        },
      }),
    );
    expect(code).toBe(EXIT_OK);
  });

  it('writes scan.json to --output-dir when --format json', async () => {
    const { stdout, stderr } = buffers();
    const code = await runScan(
      'https://example.com',
      { format: 'json', outputDir: tmpDir },
      stdout,
      stderr,
      async () => ({
        report: { scanId: 'TEST03', findings: {} },
      }),
    );
    expect(code).toBe(EXIT_OK);
    const jsonPath = join(tmpDir, 'scan.json');
    const text = await readFile(jsonPath, 'utf8');
    const parsed = JSON.parse(text) as Record<string, unknown>;
    expect(parsed['url']).toBe('https://example.com');
    expect((parsed['summary'] as Record<string, unknown>)['total']).toBe(0);
  });

  it('returns EXIT_RUNTIME_ERROR on stub navigation failure', async () => {
    const { stdout, stderr, err } = buffers();
    const code = await runScan(
      'https://example.com',
      {},
      stdout,
      stderr,
      async () => {
        throw new Error('Navigation timeout of 30000 ms exceeded');
      },
    );
    expect(code).toBe(EXIT_RUNTIME_ERROR);
    expect(err()).toMatch(/E_NAVIGATION_TIMEOUT/);
  });
});
