// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

import { afterEach, describe, expect, it, vi } from 'vitest';

// Minimal Result stand-ins matching the neverthrow surface robots-check uses
// (isOk / isErr / value / error). The whole url-guard module is mocked, so the
// test never touches the real neverthrow runtime.
function ok<T>(value: T) {
  return { isOk: () => true, isErr: () => false, value };
}
function err<E>(error: E) {
  return { isOk: () => false, isErr: () => true, error };
}

const resolveAndGuardMock = vi.hoisted(() => vi.fn());
const guardRedirectMock = vi.hoisted(() => vi.fn());
vi.mock('@ariada-org/url-guard', () => ({
  resolveAndGuard: resolveAndGuardMock,
  guardRedirect: guardRedirectMock,
}));

const { isScanAllowed } = await import('./robots-check.js');

function guardOk(u: string) {
  return ok({ url: new URL(u), pinnedAddress: '93.184.216.34', family: 4 as const });
}

afterEach(() => {
  vi.restoreAllMocks();
  resolveAndGuardMock.mockReset();
  guardRedirectMock.mockReset();
});

describe('isScanAllowed — SSRF gate', () => {
  it('fails closed when the target host is refused by the guard', async () => {
    resolveAndGuardMock.mockResolvedValue(err({ kind: 'private_resolved', host: 'x', address: '169.254.169.254' }));
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    expect(await isScanAllowed('http://169.254.169.254/')).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('fails closed when robots.txt fetch throws (network/timeout)', async () => {
    resolveAndGuardMock.mockResolvedValue(guardOk('https://example.com/'));
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('ETIMEDOUT'));
    expect(await isScanAllowed('https://example.com/')).toBe(false);
  });

  it('fails closed when a robots.txt redirect points at a private host', async () => {
    resolveAndGuardMock.mockResolvedValue(guardOk('https://example.com/'));
    guardRedirectMock.mockResolvedValue(err({ kind: 'private_literal', host: '169.254.169.254' }));
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(null, { status: 302, headers: { location: 'http://169.254.169.254/' } }),
    );
    expect(await isScanAllowed('https://example.com/')).toBe(false);
  });

  it('allows a public host that serves no robots.txt (fail-open politeness)', async () => {
    resolveAndGuardMock.mockResolvedValue(guardOk('https://example.com/'));
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 404 }));
    expect(await isScanAllowed('https://example.com/')).toBe(true);
  });

  it('respects a Disallow rule for a guarded public host', async () => {
    resolveAndGuardMock.mockResolvedValue(guardOk('https://example.com/private'));
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('User-agent: *\nDisallow: /private', { status: 200 }),
    );
    expect(await isScanAllowed('https://example.com/private')).toBe(false);
  });

  it('follows a redirect to another public host and reads its robots.txt', async () => {
    resolveAndGuardMock.mockResolvedValue(guardOk('https://example.com/'));
    guardRedirectMock.mockResolvedValue(guardOk('https://cdn.example.com/robots.txt'));
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(null, { status: 301, headers: { location: 'https://cdn.example.com/robots.txt' } }),
      )
      .mockResolvedValueOnce(new Response('User-agent: *\nAllow: /', { status: 200 }));
    expect(await isScanAllowed('https://example.com/')).toBe(true);
  });
});
