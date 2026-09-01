import { describe, it, expect } from 'vitest';

import {
  parseUtmFromUrl,
  readAriadaSrcCookie,
  makeSetCookie,
} from '../src/attribution.js';

describe('parseUtmFromUrl', () => {
  it('extracts UTM and path', () => {
    const u = new URL(
      'https://scanner.example/scan?utm_source=hn&utm_medium=referral&utm_campaign=launch',
    );
    const r = parseUtmFromUrl(u);
    expect(r.path).toBe('/scan');
    expect(r.utm_source).toBe('hn');
    expect(r.utm_medium).toBe('referral');
    expect(r.utm_campaign).toBe('launch');
  });

  it('omits missing utms', () => {
    const u = new URL('https://x.test/');
    const r = parseUtmFromUrl(u);
    expect(r.utm_source).toBeUndefined();
  });
});

describe('readAriadaSrcCookie', () => {
  it('reads ariada_src value', () => {
    expect(readAriadaSrcCookie('foo=1; ariada_src=abc123; bar=2')).toBe('abc123');
  });
  it('returns undefined when absent', () => {
    expect(readAriadaSrcCookie('foo=1')).toBeUndefined();
    expect(readAriadaSrcCookie(null)).toBeUndefined();
    expect(readAriadaSrcCookie(undefined)).toBeUndefined();
  });
  it('decodes percent-encoded values', () => {
    expect(readAriadaSrcCookie('ariada_src=hello%20world')).toBe('hello world');
  });
});

describe('makeSetCookie', () => {
  it('contains all required attributes', () => {
    const c = makeSetCookie({ name: 'ariada_src', value: 'v', maxAgeSec: 600 });
    expect(c).toContain('ariada_src=v');
    expect(c).toContain('Max-Age=600');
    expect(c).toContain('Path=/');
    expect(c).toContain('SameSite=Lax');
    expect(c).toContain('Secure');
    expect(c).toContain('HttpOnly');
  });
  it('includes Domain when provided', () => {
    const c = makeSetCookie({
      name: 'x',
      value: 'y',
      maxAgeSec: 1,
      domain: '.ariada.org',
    });
    expect(c).toContain('Domain=.ariada.org');
  });
});
