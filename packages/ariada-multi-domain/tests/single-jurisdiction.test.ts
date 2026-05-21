// SPDX-License-Identifier: EUPL-1.2
import { describe, it, expect } from 'vitest';

import { JurisdictionRegistry } from '../src/extension-api.js';
import type { JurisdictionPlugin } from '../src/plugin.js';
import { sePlugin } from '../src/plugins/index.js';
import {
  SingleJurisdictionOrchestrator,
  type SingleJurisdictionDeps,
} from '../src/single-jurisdiction.js';
import type { Finding, SnapshotRef } from '../src/types.js';

const fakeSnapshot: SnapshotRef = {
  domHash: 'a'.repeat(64),
  axTreeHash: 'b'.repeat(64),
  cssomHash: 'c'.repeat(64),
  screenshotRefs: [],
  viewports: [{ label: 'desktop', width: 1280, height: 800 }],
};

function makeDeps(overrides: Partial<SingleJurisdictionDeps> = {}): SingleJurisdictionDeps {
  let tick = 0;
  return {
    captureSnapshot: () => fakeSnapshot,
    evaluateRules: () => [],
    newId: () => '01HXYZSCANID0000000000000A',
    now: () => new Date(1716192000000 + tick++ * 10),
    ...overrides,
  };
}

function makeRegistry(plugins: JurisdictionPlugin[] = [sePlugin]): JurisdictionRegistry {
  const registry = new JurisdictionRegistry();
  for (const p of plugins) registry.register(p);
  return registry;
}

describe('SingleJurisdictionOrchestrator', () => {
  it('emits a ScanEvent with exactly one perJurisdiction entry', async () => {
    const orchestrator = new SingleJurisdictionOrchestrator({
      registry: makeRegistry(),
      scannerVersion: '0.1.0',
      ruleEngineVersion: '0.1.0',
      deps: makeDeps(),
    });
    const event = await orchestrator.scan({
      url: 'https://example.se',
      jurisdictions: ['SE'],
    });
    expect(Object.keys(event.perJurisdiction)).toEqual(['SE']);
    expect(event.jurisdictionsEffective).toEqual(['SE']);
    expect(event.conflicts).toEqual([]);
    expect(event.performance.totalAnalyzersRun).toBe(1);
    expect(event.performance.parallelism).toBe(1);
  });

  it('records the snapshot reference and rule pack version', async () => {
    const orchestrator = new SingleJurisdictionOrchestrator({
      registry: makeRegistry(),
      scannerVersion: '0.1.0',
      ruleEngineVersion: '0.1.0',
      deps: makeDeps(),
    });
    const event = await orchestrator.scan({
      url: 'https://example.se',
      jurisdictions: ['SE'],
    });
    expect(event.snapshot).toEqual(fakeSnapshot);
    expect(event.rulePackVersions['@ariada-org/wcag-rules-extended']).toBe('0.1.0');
  });

  it('forwards findings into the subset', async () => {
    const fakeFinding: Finding = {
      findingId: '01HXYZ0000000000000FIND01A',
      ruleId: 'wcag-2.2-sc-1.1.1-image-alt',
      jurisdictionTags: ['SE'],
      severity: 'serious',
      selector: 'img.hero',
      description: 'Missing alt text on hero image.',
      recommendation: 'Provide a meaningful alt attribute.',
      evidence: {
        htmlSnippet: '<img class="hero" src="hero.png" />',
        selectorPath: 'body > main > img.hero',
      },
      rationale: {
        primarySource: 'WCAG 2.2 SC 1.1.1',
        crossSource: ['EN 301 549 v3.2.1 9.1.1.1'],
      },
    };
    const orchestrator = new SingleJurisdictionOrchestrator({
      registry: makeRegistry(),
      scannerVersion: '0.1.0',
      ruleEngineVersion: '0.1.0',
      deps: makeDeps({ evaluateRules: () => [fakeFinding] }),
    });
    const event = await orchestrator.scan({
      url: 'https://example.se',
      jurisdictions: ['SE'],
    });
    expect(event.findings).toHaveLength(1);
    expect(event.perJurisdiction['SE']?.findings).toEqual([fakeFinding.findingId]);
    expect(event.perJurisdiction['SE']?.passRate).toBeLessThan(1);
  });

  it('throws when neither url nor htmlSnapshot is supplied', async () => {
    const orchestrator = new SingleJurisdictionOrchestrator({
      registry: makeRegistry(),
      scannerVersion: '0.1.0',
      ruleEngineVersion: '0.1.0',
      deps: makeDeps(),
    });
    await expect(
      orchestrator.scan({ jurisdictions: ['SE'] }),
    ).rejects.toThrow(/url.*htmlSnapshot/);
  });

  it('throws when more than one jurisdiction is requested', async () => {
    const orchestrator = new SingleJurisdictionOrchestrator({
      registry: makeRegistry(),
      scannerVersion: '0.1.0',
      ruleEngineVersion: '0.1.0',
      deps: makeDeps(),
    });
    await expect(
      orchestrator.scan({
        url: 'https://example.se',
        jurisdictions: ['SE', 'DE-BFSG'],
      }),
    ).rejects.toThrow(/exactly one jurisdiction/);
  });

  it('throws when zero jurisdictions are requested', async () => {
    const orchestrator = new SingleJurisdictionOrchestrator({
      registry: makeRegistry(),
      scannerVersion: '0.1.0',
      ruleEngineVersion: '0.1.0',
      deps: makeDeps(),
    });
    await expect(
      orchestrator.scan({ url: 'https://example.se', jurisdictions: [] }),
    ).rejects.toThrow(/exactly one jurisdiction/);
  });

  it('throws when the requested jurisdiction is not registered', async () => {
    const orchestrator = new SingleJurisdictionOrchestrator({
      registry: makeRegistry([]),
      scannerVersion: '0.1.0',
      ruleEngineVersion: '0.1.0',
      deps: makeDeps(),
    });
    await expect(
      orchestrator.scan({ url: 'https://example.se', jurisdictions: ['SE'] }),
    ).rejects.toThrow(/not registered/);
  });

  it('propagates errors from captureSnapshot without swallowing', async () => {
    const orchestrator = new SingleJurisdictionOrchestrator({
      registry: makeRegistry(),
      scannerVersion: '0.1.0',
      ruleEngineVersion: '0.1.0',
      deps: makeDeps({
        captureSnapshot: () => {
          throw new Error('CDP timeout');
        },
      }),
    });
    await expect(
      orchestrator.scan({ url: 'https://example.se', jurisdictions: ['SE'] }),
    ).rejects.toThrow(/CDP timeout/);
  });

  it('accepts htmlSnapshot input without a url', async () => {
    const orchestrator = new SingleJurisdictionOrchestrator({
      registry: makeRegistry(),
      scannerVersion: '0.1.0',
      ruleEngineVersion: '0.1.0',
      deps: makeDeps(),
    });
    const event = await orchestrator.scan({
      htmlSnapshot: '<html><body></body></html>',
      jurisdictions: ['SE'],
    });
    expect(event.url).toBe('(htmlSnapshot)');
  });

  it('records analyzer timing in performance.analyzersMs', async () => {
    const orchestrator = new SingleJurisdictionOrchestrator({
      registry: makeRegistry(),
      scannerVersion: '0.1.0',
      ruleEngineVersion: '0.1.0',
      deps: makeDeps(),
    });
    const event = await orchestrator.scan({
      url: 'https://example.se',
      jurisdictions: ['SE'],
    });
    expect(event.performance.analyzersMs['SE']).toBeGreaterThanOrEqual(0);
    expect(event.performance.snapshotMs).toBeGreaterThanOrEqual(0);
  });
});
