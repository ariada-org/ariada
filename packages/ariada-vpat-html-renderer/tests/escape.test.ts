// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { describe, expect, it } from 'vitest';

import { escapeAttr, escapeHtml } from '../src/escape.js';

describe('escapeHtml', () => {
  it('escapes the five HTML-special characters', () => {
    expect(escapeHtml('&<>"\'')).toBe('&amp;&lt;&gt;&quot;&#39;');
  });

  it('escapes XSS payloads in productName', () => {
    expect(escapeHtml('<script>alert(1)</script>')).toBe(
      '&lt;script&gt;alert(1)&lt;/script&gt;',
    );
  });

  it('returns empty string for undefined and null', () => {
    expect(escapeHtml(undefined)).toBe('');
    expect(escapeHtml(null)).toBe('');
  });

  it('passes through plain text unchanged', () => {
    expect(escapeHtml('Acme SaaS AB')).toBe('Acme SaaS AB');
  });

  it('escapes ampersand first (no double-escape)', () => {
    // Common bug: replacing & after < or > re-encodes the inserted entities.
    expect(escapeHtml('AT&T <fast>')).toBe('AT&amp;T &lt;fast&gt;');
  });
});

describe('escapeAttr', () => {
  it('escapes attribute-context strings identically to text-context', () => {
    expect(escapeAttr('"onmouseover="alert(1)"')).toBe(
      '&quot;onmouseover=&quot;alert(1)&quot;',
    );
  });
});
