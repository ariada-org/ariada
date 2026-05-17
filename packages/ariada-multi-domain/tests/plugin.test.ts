// SPDX-License-Identifier: EUPL-1.2
import { describe, it, expect } from 'vitest';

import { computePassRate, matchJurisdictionFromHints } from '../src/plugin.js';
import { sePlugin, dePlugin, euEaaPlugin } from '../src/plugins/index.js';

describe('matchJurisdictionFromHints', () => {
  const plugins = [sePlugin, dePlugin, euEaaPlugin];

  it('returns high confidence for a single TLD match', () => {
    const match = matchJurisdictionFromHints(plugins, { hostname: 'example.se' });
    expect(match?.plugin.jurisdictionCode).toBe('SE');
    expect(match?.confidence).toBe('high');
    expect(match?.matchedOn).toBe('tld');
  });

  it('returns high confidence when TLD and lang both agree', () => {
    const match = matchJurisdictionFromHints(plugins, {
      hostname: 'example.de',
      htmlLang: 'de-de',
    });
    expect(match?.plugin.jurisdictionCode).toBe('DE-BFSG');
    expect(match?.confidence).toBe('high');
    expect(match?.matchedOn).toBe('multiple');
  });

  it('returns medium confidence for a meta-only match', () => {
    const match = matchJurisdictionFromHints(plugins, {
      hostname: 'example.com',
      metaContent: 'legal:de-bfsg',
    });
    expect(match?.plugin.jurisdictionCode).toBe('DE-BFSG');
    expect(match?.confidence).toBe('medium');
  });

  it('returns low confidence for a lang-only match', () => {
    const match = matchJurisdictionFromHints(plugins, {
      hostname: 'example.com',
      htmlLang: 'sv',
    });
    expect(match?.plugin.jurisdictionCode).toBe('SE');
    expect(match?.confidence).toBe('low');
  });

  it('returns undefined when no hint matches', () => {
    const match = matchJurisdictionFromHints(plugins, { hostname: 'example.fr' });
    expect(match).toBeUndefined();
  });

  it('handles empty hints input gracefully', () => {
    const match = matchJurisdictionFromHints(plugins, {});
    expect(match).toBeUndefined();
  });
});

describe('computePassRate', () => {
  it('returns 1 when there are no findings', () => {
    expect(computePassRate([], 50)).toBe(1);
  });

  it('returns 1 when totalCriteria <= 0', () => {
    expect(computePassRate([{ severity: 'critical' }], 0)).toBe(1);
  });

  it('counts serious + critical as non-pass by default (moderate threshold)', () => {
    const findings = [
      { severity: 'critical' as const },
      { severity: 'serious' as const },
      { severity: 'moderate' as const },
      { severity: 'minor' as const },
    ];
    // Default threshold = 'moderate' → 3 non-pass out of 4 (minor is below threshold).
    expect(computePassRate(findings, 4)).toBeCloseTo(0.25);
  });

  it('respects a higher threshold (only critical counts)', () => {
    const findings = [
      { severity: 'critical' as const },
      { severity: 'serious' as const },
      { severity: 'moderate' as const },
    ];
    // Threshold = 'critical' → 1 non-pass out of 3.
    expect(computePassRate(findings, 3, 'critical')).toBeCloseTo(2 / 3);
  });

  it('clamps to non-negative when findings exceed criteria', () => {
    const findings = Array.from({ length: 10 }, () => ({
      severity: 'critical' as const,
    }));
    expect(computePassRate(findings, 5)).toBe(0);
  });
});
