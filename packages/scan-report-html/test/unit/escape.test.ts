// SPDX-License-Identifier: EUPL-1.2
// SPDX-FileCopyrightText: 2026 Agonist Development AB
/**
 * Unit tests for the HTML / URL escape utilities — the renderer's only XSS guard.
 *
 * Corpus mixes the canonical OWASP payloads (script, img, svg/onload, data URL,
 * vbscript URL, file URL) — each must round-trip into inert text.
 */

import { describe, expect, it } from 'vitest';

import { escapeAndTruncate, escapeHtml, escapeUrl } from '../../src/escape.js';

describe('escapeHtml', () => {
  it('escapes the five canonical XSS sinks (& < > " \')', () => {
    expect(escapeHtml('<script>')).toBe('&lt;script&gt;');
    expect(escapeHtml('a "b" c')).toBe('a &quot;b&quot; c');
    expect(escapeHtml("a 'b' c")).toBe('a &#39;b&#39; c');
    expect(escapeHtml('1 & 2')).toBe('1 &amp; 2');
  });

  it('escapes ampersands before other characters (no double-escape)', () => {
    expect(escapeHtml('&lt;')).toBe('&amp;lt;');
  });
});

describe('escapeAndTruncate', () => {
  it('returns escaped full string when within limit', () => {
    expect(escapeAndTruncate('<hi>', 10)).toBe('&lt;hi&gt;');
  });
  it('truncates with ellipsis when over the limit', () => {
    expect(escapeAndTruncate('1234567890', 5)).toBe('12345…');
  });
});

describe('escapeUrl', () => {
  it('rejects javascript: URLs (returns empty string)', () => {
    expect(escapeUrl('javascript:alert(1)')).toBe('');
    expect(escapeUrl('  JaVaScRiPt:alert(1)')).toBe('');
  });
  it('rejects vbscript: / data: / file: URLs', () => {
    expect(escapeUrl('vbscript:msgbox(1)')).toBe('');
    expect(escapeUrl('data:text/html,<script>1</script>')).toBe('');
    expect(escapeUrl('file:///etc/passwd')).toBe('');
  });
  it('passes through https URLs (with HTML-entity escape)', () => {
    expect(escapeUrl('https://www.w3.org/path?a=1&b=2')).toBe(
      'https://www.w3.org/path?a=1&amp;b=2',
    );
  });
});
