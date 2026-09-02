// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { describe, it, expect } from 'vitest';

import {
  BUILT_IN_DOMAINS,
  validateModuleInput,
  toColumns,
} from './domain-config.js';

describe('BUILT_IN_DOMAINS', () => {
  it('lists the panel domains with human labels — security excluded', () => {
    // Security is intentionally NOT offered in the browser panel: it decides
    // solely from HTTP response headers, which a content script cannot read, so
    // it would flag every page falsely. The command-line tool runs it instead.
    expect(BUILT_IN_DOMAINS.map((d) => d.id)).toEqual([
      'accessibility',
      'privacy',
      'ai-readiness',
      'structured-data',
      'sustainability',
    ]);
    expect(BUILT_IN_DOMAINS.map((d) => d.id)).not.toContain('security');
    expect(BUILT_IN_DOMAINS.every((d) => d.label.length > 0)).toBe(true);
  });
});

describe('validateModuleInput', () => {
  it('accepts an npm package name matching the ariada-domain convention', () => {
    expect(validateModuleInput('ariada-domain-bitv20')).toEqual({ ok: true, kind: 'npm' });
    expect(validateModuleInput('@org/ariada-domain-gdpr')).toEqual({ ok: true, kind: 'npm' });
  });

  it('rejects an http/https URL with the Chrome Web Store policy reason', () => {
    const r = validateModuleInput('https://cdn.example.com/mod.js');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason.toLowerCase()).toContain('remote');
    }
  });

  it('rejects a package name that does not follow the convention', () => {
    const r = validateModuleInput('left-pad');
    expect(r.ok).toBe(false);
  });

  it('accepts a local file path ending in .js or .mjs', () => {
    expect(validateModuleInput('./my/domain.js')).toEqual({ ok: true, kind: 'local-file' });
    expect(validateModuleInput('/abs/domain.mjs')).toEqual({ ok: true, kind: 'local-file' });
  });
});

describe('toColumns', () => {
  it('maps the built-in domains to built-in source columns', () => {
    const cols = toColumns(BUILT_IN_DOMAINS.map((d) => d.id), []);
    expect(cols).toHaveLength(5);
    expect(cols.every((c) => c.source === 'built-in')).toBe(true);
  });

  it('marks a pluggable module column with its source and trust', () => {
    const cols = toColumns(['accessibility', 'stub-a11y'], [
      { id: 'stub-a11y', label: 'Stub', source: 'local-file', trusted: false, version: '0.0.1' },
    ]);
    const stub = cols.find((c) => c.id === 'stub-a11y');
    expect(stub?.source).toBe('local-file');
    expect(stub?.trusted).toBe(false);
  });
});
