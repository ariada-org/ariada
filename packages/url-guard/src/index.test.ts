// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

import { afterEach, describe, expect, it, vi } from 'vitest';

const lookupMock = vi.hoisted(() => vi.fn());
vi.mock('node:dns/promises', () => ({ lookup: lookupMock }));

const { assertSafeUrl, resolveAndGuard, guardRedirect } = await import('./index.js');

afterEach(() => {
  lookupMock.mockReset();
});

describe('assertSafeUrl', () => {
  it('allows a normal public https URL', () => {
    const r = assertSafeUrl('https://example.com/path');
    expect(r.isOk()).toBe(true);
    if (r.isOk()) expect(r.value.hostname).toBe('example.com');
  });

  it.each([
    'ftp://example.com/',
    'file:///etc/passwd',
    'data:text/html,<script>alert(1)</script>',
    'javascript:alert(1)',
    'gopher://example.com/',
    'ws://example.com/',
  ])('rejects non-http(s) scheme %s', (input) => {
    const r = assertSafeUrl(input);
    expect(r.isErr()).toBe(true);
    if (r.isErr()) expect(r.error.kind).toBe('scheme_not_allowed');
  });

  it.each([
    'http://169.254.169.254/latest/meta-data/', // cloud metadata
    'http://127.0.0.1:6379/',
    'http://10.0.0.5/admin',
    'http://192.168.1.1/',
    'http://2130706433/', // decimal literal for 127.0.0.1 (WHATWG-normalized)
    'http://0x7f000001/', // hex literal for 127.0.0.1
    'http://[::1]/',
    'http://[::ffff:169.254.169.254]/', // IPv4-mapped IPv6 metadata
    'http://[::ffff:127.0.0.1]/', // IPv4-mapped IPv6 loopback
  ])('rejects private/loopback literal %s', (input) => {
    const r = assertSafeUrl(input);
    expect(r.isErr()).toBe(true);
    if (r.isErr()) expect(r.error.kind).toBe('private_literal');
  });

  it('rejects localhost by name', () => {
    const r = assertSafeUrl('http://localhost:3000/');
    expect(r.isErr()).toBe(true);
    if (r.isErr()) expect(r.error.kind).toBe('private_literal');
  });

  it('allows private literals when allowPrivate=true', () => {
    const r = assertSafeUrl('http://127.0.0.1:3000/', { allowPrivate: true });
    expect(r.isOk()).toBe(true);
  });

  it('reports unparseable input', () => {
    const r = assertSafeUrl('not a url');
    expect(r.isErr()).toBe(true);
    if (r.isErr()) expect(r.error.kind).toBe('unparseable');
  });
});

describe('resolveAndGuard', () => {
  it('allows a public host and pins its resolved address', async () => {
    lookupMock.mockResolvedValue([{ address: '93.184.216.34', family: 4 }]);
    const r = await resolveAndGuard('https://example.com/');
    expect(r.isOk()).toBe(true);
    if (r.isOk()) {
      expect(r.value.pinnedAddress).toBe('93.184.216.34');
      expect(r.value.family).toBe(4);
    }
  });

  it('refuses a host that resolves to the metadata IP (DNS-rebinding)', async () => {
    lookupMock.mockResolvedValue([{ address: '169.254.169.254', family: 4 }]);
    const r = await resolveAndGuard('https://rebind.example/');
    expect(r.isErr()).toBe(true);
    if (r.isErr()) {
      expect(r.error.kind).toBe('private_resolved');
      if (r.error.kind === 'private_resolved') expect(r.error.address).toBe('169.254.169.254');
    }
  });

  it('refuses if ANY resolved address is private', async () => {
    lookupMock.mockResolvedValue([
      { address: '93.184.216.34', family: 4 },
      { address: '10.0.0.5', family: 4 },
    ]);
    const r = await resolveAndGuard('https://mixed.example/');
    expect(r.isErr()).toBe(true);
    if (r.isErr()) expect(r.error.kind).toBe('private_resolved');
  });

  it('reports resolution failure', async () => {
    lookupMock.mockRejectedValue(new Error('ENOTFOUND'));
    const r = await resolveAndGuard('https://nx.example/');
    expect(r.isErr()).toBe(true);
    if (r.isErr()) expect(r.error.kind).toBe('resolution_failed');
  });

  it('does not resolve a private literal at all', async () => {
    const r = await resolveAndGuard('http://169.254.169.254/');
    expect(r.isErr()).toBe(true);
    expect(lookupMock).not.toHaveBeenCalled();
  });
});

describe('guardRedirect', () => {
  it('refuses a redirect to the metadata service', async () => {
    const r = await guardRedirect('http://169.254.169.254/latest/', 'https://public.example/');
    expect(r.isErr()).toBe(true);
    if (r.isErr()) expect(r.error.kind).toBe('private_literal');
  });

  it('resolves a relative Location against its base and re-guards', async () => {
    lookupMock.mockResolvedValue([{ address: '93.184.216.34', family: 4 }]);
    const r = await guardRedirect('/next', 'https://example.com/start');
    expect(r.isOk()).toBe(true);
    if (r.isOk()) expect(r.value.url.href).toBe('https://example.com/next');
  });
});

describe('an address is the destination, not something to look up', () => {
  it('allows a site reachable only by an IPv6 address', async () => {
    // A URL keeps an IPv6 literal in its brackets, and no resolver accepts
    // those. Asking anyway failed, so every such site was refused for a lookup
    // that should never have happened.
    for (const url of ['http://[2001:4860:4860::8888]/', 'http://[::ffff:93.184.216.34]/']) {
      const result = await resolveAndGuard(url, {});
      expect(result.isOk()).toBe(true);
    }
  });

  it('pins to the address itself, without its brackets', async () => {
    const result = await resolveAndGuard('http://[2001:4860:4860::8888]/', {});
    expect(result._unsafeUnwrap().pinnedAddress).toBe('2001:4860:4860::8888');
    expect(result._unsafeUnwrap().family).toBe(6);
  });

  it('still refuses a private one, in any notation', async () => {
    for (const url of ['http://[::1]/', 'http://[fd00::1]/', 'http://[::ffff:169.254.169.254]/', 'http://[64:ff9b::a9fe:a9fe]/']) {
      const result = await resolveAndGuard(url, {});
      expect(result.isErr()).toBe(true);
    }
  });
});
