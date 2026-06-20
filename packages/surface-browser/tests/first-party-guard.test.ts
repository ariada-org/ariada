// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { describe, expect, it } from 'vitest';

import type { DomainAnalyzer } from '@ariada-org/core-engine';
import { applyFirstPartyGuard, isSameOrigin } from '../src/first-party-guard.js';

// Minimal stub to test the guard without needing a real analyzer.
function makeAnalyzer(domain: string, builtIn?: boolean): DomainAnalyzer & { builtIn?: boolean } {
  return {
    domain,
    version: 'test',
    ruleIds: [],
    async analyze() { return []; },
    async analyzeElement() { return []; },
    ...(builtIn !== undefined ? { builtIn } : {}),
  };
}

describe('isSameOrigin', () => {
  it('returns true when origins match', () => {
    expect(isSameOrigin('https://example.com', 'https://example.com/page')).toBe(true);
  });

  it('returns false when origins differ (scheme)', () => {
    expect(isSameOrigin('http://example.com', 'https://example.com/page')).toBe(false);
  });

  it('returns false when origins differ (host)', () => {
    expect(isSameOrigin('https://attacker.com', 'https://victim.com/page')).toBe(false);
  });

  it('returns false when origins differ (port)', () => {
    expect(isSameOrigin('https://example.com:3000', 'https://example.com:4000/page')).toBe(false);
  });

  it('returns false for about:blank document URL', () => {
    expect(isSameOrigin('https://example.com', 'about:blank')).toBe(false);
  });

  it('returns false for empty document URL', () => {
    expect(isSameOrigin('https://example.com', '')).toBe(false);
  });

  it('returns true for localhost matching', () => {
    expect(isSameOrigin('http://localhost:3000', 'http://localhost:3000/index.html')).toBe(true);
  });
});

describe('applyFirstPartyGuard', () => {
  const builtInAnalyzer = makeAnalyzer('a11y', true);
  const thirdPartyAnalyzer = makeAnalyzer('custom');
  const allAnalyzers = [builtInAnalyzer, thirdPartyAnalyzer];

  it('passes through all analyzers when same-origin (not cross-origin)', () => {
    const { filtered, firstPartyOnly } = applyFirstPartyGuard(allAnalyzers, false);
    expect(filtered).toHaveLength(2);
    expect(firstPartyOnly).toBe(false);
  });

  it('filters to built-in only when cross-origin', () => {
    const { filtered, firstPartyOnly } = applyFirstPartyGuard(allAnalyzers, true);
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.domain).toBe('a11y');
    expect(firstPartyOnly).toBe(true);
  });

  it('returns empty list when cross-origin and no built-in analyzers', () => {
    const { filtered, firstPartyOnly } = applyFirstPartyGuard([thirdPartyAnalyzer], true);
    expect(filtered).toHaveLength(0);
    expect(firstPartyOnly).toBe(true);
  });

  it('returns all analyzers when cross-origin and all are built-in', () => {
    const both = [makeAnalyzer('a11y', true), makeAnalyzer('privacy', true)];
    const { filtered, firstPartyOnly } = applyFirstPartyGuard(both, true);
    expect(filtered).toHaveLength(2);
    expect(firstPartyOnly).toBe(true);
  });

  it('handles empty analyzer list gracefully', () => {
    const { filtered, firstPartyOnly } = applyFirstPartyGuard([], true);
    expect(filtered).toHaveLength(0);
    expect(firstPartyOnly).toBe(true);
  });
});
