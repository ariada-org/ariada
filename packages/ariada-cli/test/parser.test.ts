// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { Writable } from 'node:stream';

import { describe, it, expect } from 'vitest';

import {
  EXIT_OK,
  EXIT_INVALID_ARGS,
  EXIT_UNIMPLEMENTED,
} from '../src/exit-codes.js';
import { run } from '../src/parser.js';

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

describe('parser — top-level help', () => {
  it('shows all 5 subcommands in --help output', async () => {
    const { stdout, stderr, out } = buffers();
    const code = await run(['--help'], { stdout, stderr });
    expect(code).toBe(EXIT_OK);
    const text = out();
    expect(text).toMatch(/scan/);
    expect(text).toMatch(/list-rules/);
    expect(text).toMatch(/version/);
    expect(text).toMatch(/generate-statement/);
    expect(text).toMatch(/estimate-penalty/);
  });
});

describe('parser — version subcommand', () => {
  it('prints version info and exits 0', async () => {
    const { stdout, stderr, out } = buffers();
    const code = await run(['version'], { stdout, stderr });
    expect(code).toBe(EXIT_OK);
    expect(out()).toMatch(/@ariada-org\/cli 0\.1\.0/);
    expect(out()).toMatch(/node \d+\./);
  });
});

describe('parser — list-rules subcommand', () => {
  it('returns at least one rule in human format', async () => {
    const { stdout, stderr, out } = buffers();
    const code = await run(['list-rules', '--format', 'human'], { stdout, stderr });
    expect(code).toBe(EXIT_OK);
    expect(out()).toMatch(/rule[s]? registered/);
  });

  it('emits valid JSON when --format json', async () => {
    const { stdout, stderr, out } = buffers();
    const code = await run(['list-rules', '--format', 'json'], { stdout, stderr });
    expect(code).toBe(EXIT_OK);
    const parsed = JSON.parse(out()) as unknown[];
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBeGreaterThan(0);
  });

  it('rejects unknown --format value with exit 2', async () => {
    const { stdout, stderr, out, err } = buffers();
    const code = await run(['list-rules', '--format', 'bogus'], { stdout, stderr });
    expect(code).toBe(EXIT_INVALID_ARGS);
    expect(err()).toMatch(/E_INVALID_OPTION/);
    expect(out()).toBe('');
  });
});

describe('parser — generate-statement stub', () => {
  it('exits 4 (EXIT_UNIMPLEMENTED) and points to upstream library', async () => {
    const { stdout, stderr, out } = buffers();
    const code = await run(['generate-statement'], { stdout, stderr });
    expect(code).toBe(EXIT_UNIMPLEMENTED);
    expect(out()).toMatch(/not yet implemented/);
    expect(out()).toMatch(/@ariada-org\/statement-generator/);
  });
});

describe('parser — estimate-penalty stub', () => {
  it('exits 4 (EXIT_UNIMPLEMENTED) and points to upstream library', async () => {
    const { stdout, stderr, out } = buffers();
    const code = await run(['estimate-penalty'], { stdout, stderr });
    expect(code).toBe(EXIT_UNIMPLEMENTED);
    expect(out()).toMatch(/not yet implemented/);
    expect(out()).toMatch(/@ariada-org\/penalty-estimator/);
  });
});

describe('parser — scan argument validation', () => {
  it('exits 2 when URL is missing', async () => {
    const { stdout, stderr, err } = buffers();
    const code = await run(['scan'], { stdout, stderr });
    expect(code).toBe(EXIT_INVALID_ARGS);
    expect(err()).toMatch(/E_INVALID_OPTION/);
  });

  it('exits 2 when URL has wrong scheme', async () => {
    const { stdout, stderr, err } = buffers();
    const code = await run(['scan', 'ftp://example.com'], { stdout, stderr });
    expect(code).toBe(EXIT_INVALID_ARGS);
    expect(err()).toMatch(/E_INVALID_URL/);
  });

  it('exits 2 on unknown --severity-threshold', async () => {
    const { stdout, stderr, err } = buffers();
    const code = await run(['scan', 'https://example.com', '--severity-threshold', 'bogus'], {
      stdout,
      stderr,
    });
    expect(code).toBe(EXIT_INVALID_ARGS);
    expect(err()).toMatch(/E_INVALID_OPTION/);
  });

  it('exits 2 on unknown subcommand', async () => {
    const { stdout, stderr, err } = buffers();
    const code = await run(['nonexistent-cmd'], { stdout, stderr });
    expect(code).toBe(EXIT_INVALID_ARGS);
    expect(err()).toMatch(/E_INVALID_OPTION/);
  });
});
