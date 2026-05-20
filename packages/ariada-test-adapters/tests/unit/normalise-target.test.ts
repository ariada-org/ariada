// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { describe, expect, it } from 'vitest';

import { AriadaTestAdapterError } from '../../src/internal/error.js';
import { normaliseTarget } from '../../src/internal/normalise-target.js';

describe('normaliseTarget', () => {
  it('detects http URLs as url targets', () => {
    expect(normaliseTarget('https://example.com')).toEqual({
      kind: 'url',
      url: 'https://example.com',
    });
  });

  it('detects http:// URLs (non-https) as url targets', () => {
    expect(normaliseTarget('http://localhost:3000')).toEqual({
      kind: 'url',
      url: 'http://localhost:3000',
    });
  });

  it('detects file:// URLs as url targets', () => {
    expect(normaliseTarget('file:///tmp/page.html')).toEqual({
      kind: 'url',
      url: 'file:///tmp/page.html',
    });
  });

  it('treats non-URL strings as html literals', () => {
    expect(normaliseTarget('<html><body>hi</body></html>')).toEqual({
      kind: 'html',
      html: '<html><body>hi</body></html>',
    });
  });

  it('extracts url from { url } objects', () => {
    expect(normaliseTarget({ url: 'https://example.com' })).toEqual({
      kind: 'url',
      url: 'https://example.com',
    });
  });

  it('extracts html from { html } objects', () => {
    expect(normaliseTarget({ html: '<p>hi</p>' })).toEqual({
      kind: 'html',
      html: '<p>hi</p>',
    });
  });

  it('recognises a PageLike object via duck typing', () => {
    const page = {
      goto: async () => undefined,
      url: () => 'https://example.com',
    };
    const out = normaliseTarget(page);
    expect(out.kind).toBe('page');
  });

  it('throws ERR_A11Y_TARGET_INVALID on null', () => {
    expect(() => normaliseTarget(null)).toThrow(AriadaTestAdapterError);
  });

  it('throws ERR_A11Y_TARGET_INVALID on number', () => {
    try {
      normaliseTarget(42);
      expect.fail('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(AriadaTestAdapterError);
      expect((err as AriadaTestAdapterError).code).toBe('ERR_A11Y_TARGET_INVALID');
    }
  });

  it('throws on empty string', () => {
    expect(() => normaliseTarget('')).toThrow(AriadaTestAdapterError);
  });

  it('throws on plain {} object', () => {
    expect(() => normaliseTarget({})).toThrow(AriadaTestAdapterError);
  });
});
