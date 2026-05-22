// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Unit tests for `startFixtureServer` (tests/unit/serve.test.ts).
// Covers: server returns `{url, port, stop}`; port resolves to a positive
// integer; `stop()` resolves; invalid `opts.port` rejects with RangeError.

import { describe, expect, it } from 'vitest';

import { startFixtureServer } from '../../src/serve.ts';

describe('startFixtureServer', () => {
  it('returns an object with `url`, `port`, and `stop`', async () => {
    const fx = await startFixtureServer();
    try {
      expect(typeof fx.url).toBe('string');
      expect(typeof fx.port).toBe('number');
      expect(typeof fx.stop).toBe('function');
    } finally {
      await fx.stop();
    }
  });

  it('resolves `port` to a positive integer in the uint16 range', async () => {
    const fx = await startFixtureServer();
    try {
      expect(Number.isInteger(fx.port)).toBe(true);
      expect(fx.port).toBeGreaterThan(0);
      expect(fx.port).toBeLessThanOrEqual(65535);
    } finally {
      await fx.stop();
    }
  });

  it('binds to `127.0.0.1` (loopback only) and reflects it in `url`', async () => {
    const fx = await startFixtureServer();
    try {
      expect(fx.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
      expect(fx.url.endsWith(`:${String(fx.port)}`)).toBe(true);
    } finally {
      await fx.stop();
    }
  });

  it('`stop()` resolves and shuts the server down', async () => {
    const fx = await startFixtureServer();
    await expect(fx.stop()).resolves.toBeUndefined();
  });

  it('rejects an out-of-range `opts.port` with `RangeError`', async () => {
    await expect(startFixtureServer({ port: -1 })).rejects.toBeInstanceOf(
      RangeError,
    );
    await expect(startFixtureServer({ port: 70000 })).rejects.toBeInstanceOf(
      RangeError,
    );
  });
});
