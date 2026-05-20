// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { describe, expect, it } from 'vitest';

import { createRegistry, getDefaultRegistry, registerAnalyzer } from '../src/registry.js';
import type { AnalyzerContext, DomainAnalyzer } from '../src/types.js';

function stubAnalyzer(domain: string, version = '0.0.1'): DomainAnalyzer {
  return {
    domain,
    version,
    ruleIds: [],
    analyze: async (_ctx: AnalyzerContext) => [],
  };
}

describe('createRegistry', () => {
  it('registers and retrieves analyzers by domain', () => {
    const reg = createRegistry();
    const a = stubAnalyzer('a11y');
    reg.register(a);
    expect(reg.get('a11y')).toBe(a);
  });

  it('last-write-wins on duplicate domain', () => {
    const reg = createRegistry();
    const a1 = stubAnalyzer('a11y', '1');
    const a2 = stubAnalyzer('a11y', '2');
    reg.register(a1);
    reg.register(a2);
    expect(reg.get('a11y')?.version).toBe('2');
  });

  it('all() returns every registered analyzer', () => {
    const reg = createRegistry();
    reg.register(stubAnalyzer('a11y'));
    reg.register(stubAnalyzer('cwv'));
    expect(reg.all().map((a) => a.domain).sort()).toEqual(['a11y', 'cwv']);
  });

  it('get() returns undefined for unknown domain', () => {
    const reg = createRegistry();
    expect(reg.get('unknown')).toBeUndefined();
  });
});

describe('default registry', () => {
  it('registerAnalyzer populates the module default registry', () => {
    const domain = `probe-${Math.random()}`;
    registerAnalyzer(stubAnalyzer(domain));
    expect(getDefaultRegistry().get(domain)).toBeDefined();
  });
});
