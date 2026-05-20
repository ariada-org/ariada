// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { Writable } from 'node:stream';

import { describe, it, expect } from 'vitest';

import { CliError, emitError } from '../src/errors.js';

function makeBufferStream(): { stream: Writable; getText: () => string } {
  const chunks: Buffer[] = [];
  const stream = new Writable({
    write(chunk: Buffer, _enc, cb) {
      chunks.push(chunk);
      cb();
    },
  });
  return { stream, getText: () => Buffer.concat(chunks).toString('utf8') };
}

describe('CliError', () => {
  it('serialises to a single-line JSON object on stderr', () => {
    const { stream, getText } = makeBufferStream();
    emitError(new CliError('E_INVALID_URL', 'bad url', { url: 'ftp://x' }), stream);
    const out = getText().trim();
    const parsed = JSON.parse(out) as Record<string, unknown>;
    expect(parsed['level']).toBe('error');
    expect(parsed['code']).toBe('E_INVALID_URL');
    expect(parsed['message']).toBe('bad url');
    expect((parsed['details'] as Record<string, unknown>)['url']).toBe('ftp://x');
  });

  it('wraps generic Error as E_INTERNAL', () => {
    const { stream, getText } = makeBufferStream();
    emitError(new Error('boom'), stream);
    const parsed = JSON.parse(getText().trim()) as Record<string, unknown>;
    expect(parsed['code']).toBe('E_INTERNAL');
    expect(parsed['message']).toBe('boom');
  });

  it('wraps non-Error throwables as E_INTERNAL string', () => {
    const { stream, getText } = makeBufferStream();
    emitError('plain string', stream);
    const parsed = JSON.parse(getText().trim()) as Record<string, unknown>;
    expect(parsed['code']).toBe('E_INTERNAL');
    expect(parsed['message']).toBe('plain string');
  });

  it('emits exactly one line terminated by \\n', () => {
    const { stream, getText } = makeBufferStream();
    emitError(new CliError('E_INTERNAL', 'x'), stream);
    const out = getText();
    expect(out.endsWith('\n')).toBe(true);
    expect(out.split('\n').filter((l) => l.length > 0)).toHaveLength(1);
  });
});
