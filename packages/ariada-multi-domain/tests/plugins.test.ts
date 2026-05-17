// SPDX-License-Identifier: EUPL-1.2
import { describe, it, expect } from 'vitest';

import { sePlugin, dePlugin, euEaaPlugin } from '../src/plugins/index.js';
import type { Finding, PartialScanContext, SnapshotRef } from '../src/types.js';

const emptySnapshot: SnapshotRef = {
  domHash: 'a'.repeat(64),
  axTreeHash: 'b'.repeat(64),
  cssomHash: 'c'.repeat(64),
  screenshotRefs: [],
  viewports: [],
};

function makeContext(findings: Finding[] = []): PartialScanContext {
  return {
    url: 'https://example.test',
    effectiveUrl: 'https://example.test',
    snapshot: emptySnapshot,
    findings,
  };
}

const sampleFinding = (jurisdictionTags: string[]): Finding => ({
  findingId: '01HXYZ0000000000000FIND01A',
  ruleId: 'wcag-2.2-sc-1.1.1-image-alt',
  jurisdictionTags,
  severity: 'serious',
  selector: 'img',
  description: 'Missing alt.',
  recommendation: 'Add alt.',
  evidence: {
    htmlSnippet: '<img/>',
    selectorPath: 'body > img',
  },
  rationale: { primarySource: 'WCAG 2.2 SC 1.1.1', crossSource: [] },
});

describe('reference plugins', () => {
  it('SE plugin emits SE-tagged findings only', () => {
    const subset = sePlugin.emitJurisdictionSubset(
      makeContext([sampleFinding(['SE']), sampleFinding(['DE-BFSG'])]),
    );
    expect(subset.jurisdictionCode).toBe('SE');
    expect(subset.findings).toHaveLength(1);
    expect(subset.passRate).toBeLessThan(1);
  });

  it('DE plugin emits DE-BFSG-tagged findings only', () => {
    const subset = dePlugin.emitJurisdictionSubset(
      makeContext([sampleFinding(['SE']), sampleFinding(['DE-BFSG'])]),
    );
    expect(subset.jurisdictionCode).toBe('DE-BFSG');
    expect(subset.findings).toHaveLength(1);
  });

  it('EU-EAA plugin emits EU-EAA-tagged findings only', () => {
    const subset = euEaaPlugin.emitJurisdictionSubset(
      makeContext([sampleFinding(['EU-EAA']), sampleFinding(['SE'])]),
    );
    expect(subset.jurisdictionCode).toBe('EU-EAA');
    expect(subset.findings).toHaveLength(1);
  });

  it('passRate is 1 when no relevant findings exist', () => {
    const subset = sePlugin.emitJurisdictionSubset(makeContext([]));
    expect(subset.passRate).toBe(1);
  });

  it('all reference plugins cite a governing statute and standard', () => {
    for (const plugin of [sePlugin, dePlugin, euEaaPlugin]) {
      expect(plugin.governingRegulation.length).toBeGreaterThan(0);
      expect(plugin.technicalStandard.length).toBeGreaterThan(0);
      expect(plugin.supervisoryAuthority.length).toBeGreaterThan(0);
    }
  });

  it('all reference plugins declare TLD hints', () => {
    expect(sePlugin.tldHints).toContain('se');
    expect(dePlugin.tldHints).toContain('de');
    expect(euEaaPlugin.tldHints).toContain('eu');
  });
});
