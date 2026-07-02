// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

import { describe, expect, it } from 'vitest';

import { ERROR_CODES, McpServerError } from '../src/errors.js';
import {
  guardUrl,
  isLoopbackName,
  isPrivateIpv4,
  isPrivateIpv6,
} from '../src/ssrf-guard.js';

describe('isPrivateIpv4', () => {
  it.each([
    ['10.0.0.1', true],
    ['10.255.255.255', true],
    ['127.0.0.1', true],
    ['169.254.1.1', true],
    ['172.16.0.1', true],
    ['172.31.255.255', true],
    ['172.32.0.1', false],
    ['192.168.1.1', true],
    ['100.64.0.1', true],
    ['100.127.255.255', true],
    ['100.128.0.1', false],
    ['8.8.8.8', false],
    ['1.1.1.1', false],
    ['example.com', false],
  ])('classifies %s as private=%s', (host, expected) => {
    expect(isPrivateIpv4(host)).toBe(expected);
  });
});

describe('isLoopbackName', () => {
  it('matches localhost variants', () => {
    expect(isLoopbackName('localhost')).toBe(true);
    expect(isLoopbackName('LOCALHOST')).toBe(true);
    expect(isLoopbackName('localhost.localdomain')).toBe(true);
    expect(isLoopbackName('example.com')).toBe(false);
  });
});

describe('isPrivateIpv6', () => {
  it('flags ::1 and link-local prefixes', () => {
    expect(isPrivateIpv6('::1')).toBe(true);
    expect(isPrivateIpv6('fe80::1')).toBe(true);
    expect(isPrivateIpv6('fd00::1')).toBe(true);
    expect(isPrivateIpv6('2001:4860:4860::8888')).toBe(false);
  });

  it('flags IPv4-mapped IPv6 pointing at private/metadata/loopback', () => {
    expect(isPrivateIpv6('::ffff:169.254.169.254')).toBe(true);
    expect(isPrivateIpv6('::ffff:127.0.0.1')).toBe(true);
    expect(isPrivateIpv6('[::ffff:127.0.0.1]')).toBe(true);
    expect(isPrivateIpv6('::ffff:a9fe:a9fe')).toBe(true); // hex form of 169.254.169.254
    expect(isPrivateIpv6('::ffff:8.8.8.8')).toBe(false);
  });
});

describe('guardUrl', () => {
  it('accepts public https URLs', () => {
    const u = guardUrl('https://example.com/path');
    expect(u.hostname).toBe('example.com');
  });

  it('refuses file:// scheme with SsrfRefused', () => {
    try {
      guardUrl('file:///etc/passwd');
      throw new Error('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(McpServerError);
      expect((err as McpServerError).code).toBe(ERROR_CODES.SsrfRefused);
    }
  });

  it.each([
    'ftp://example.com/',
    'data:text/html,<script>alert(1)</script>',
    'javascript:alert(1)',
    'vbscript:msgbox(1)',
    'blob:https://example.com/uuid',
    'gopher://example.com/',
    'ws://example.com/',
  ])('refuses non-http(s) scheme %s with SsrfRefused', (input) => {
    try {
      guardUrl(input);
      throw new Error('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(McpServerError);
      expect((err as McpServerError).code).toBe(ERROR_CODES.SsrfRefused);
    }
  });

  it('does not accept a scheme by substring (HTTPS-lookalike is rejected)', () => {
    // A scheme that merely contains "http" must not pass — the check compares
    // the exact normalised protocol, not a substring.
    try {
      guardUrl('xhttp://example.com/');
      throw new Error('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(McpServerError);
      expect((err as McpServerError).code).toBe(ERROR_CODES.SsrfRefused);
    }
  });

  it('refuses RFC 1918 host by default', () => {
    try {
      guardUrl('http://10.0.0.1/');
      throw new Error('expected throw');
    } catch (err) {
      expect((err as McpServerError).code).toBe(ERROR_CODES.SsrfRefused);
    }
  });

  it('refuses localhost by default', () => {
    try {
      guardUrl('http://localhost/');
      throw new Error('expected throw');
    } catch (err) {
      expect((err as McpServerError).code).toBe(ERROR_CODES.SsrfRefused);
    }
  });

  it('refuses 127.0.0.1 by default', () => {
    try {
      guardUrl('http://127.0.0.1:3000/path');
      throw new Error('expected throw');
    } catch (err) {
      expect((err as McpServerError).code).toBe(ERROR_CODES.SsrfRefused);
    }
  });

  it.each([
    'http://[::ffff:169.254.169.254]/latest/meta-data/',
    'http://[::ffff:127.0.0.1]/',
  ])('refuses IPv4-mapped IPv6 %s that the old prefix check missed', (input) => {
    try {
      guardUrl(input);
      throw new Error('expected throw');
    } catch (err) {
      expect((err as McpServerError).code).toBe(ERROR_CODES.SsrfRefused);
    }
  });

  it('allows private URLs when allowPrivate=true', () => {
    const u = guardUrl('http://127.0.0.1:3000/path', { allowPrivate: true });
    expect(u.hostname).toBe('127.0.0.1');
  });

  it('throws InvalidParams on unparseable URLs', () => {
    try {
      guardUrl('not a url');
      throw new Error('expected throw');
    } catch (err) {
      expect((err as McpServerError).code).toBe(ERROR_CODES.InvalidParams);
    }
  });
});
