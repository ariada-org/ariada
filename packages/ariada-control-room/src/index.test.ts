// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { describe, expect, it } from 'vitest';

import { deriveControlRoomView, LAMP_RANK, worstLamp } from './index.ts';

const LIVE_SNAPSHOT = {
  generatedFromCommit: '72422d45',
  branch: 'modules-integration',
  lastCommit: 'feat(control-room): add last-audit-run + recent-commits to the snapshot',
  bus: {
    catalog: { packages: 71, publishEligible: 58, publishedNpm: 21, sourceOnly: 37, inSync: true, drift: 0 },
    liveDeployDriftFacts: 0,
    liveDeployDrift: [],
  },
  selfRegulatingLoop: { factCount: 0, facts: [] },
  cron: [
    { name: 'self-audit', loaded: true, lastExit: '0' },
    { name: 'release-pipeline', loaded: true, lastExit: '0' },
    { name: 'ci-health', loaded: true, lastExit: '0' },
    { name: 'repo-embed', loaded: true, lastExit: '0' },
  ],
  inventory: { integrations: 97, packages: 76 },
  surfaces: [
    { name: 'demo (P10)', present: true },
    { name: 'Shopify (P11)', present: true },
    { name: 'WordPress (P12)', present: true },
    { name: 'Vercel (P9)', present: true },
    { name: 'Chrome ext (P8)', present: true },
  ],
  recentCommits: ['72422d45 feat(control-room): add last-audit-run + recent-commits to the snapshot'],
  lastAuditRun: '2026-07-09T22:24:34Z',
};

describe('deriveControlRoomView — real snapshot (dogfood run)', () => {
  const view = deriveControlRoomView(LIVE_SNAPSHOT);

  it('bus: in sync → ok, exposes the real counts', () => {
    expect(view.bus.status).toBe('ok');
    expect(view.bus.packages).toBe(71);
    expect(view.bus.publishedNpm).toBe(21);
    expect(view.bus.inSync).toBe(true);
  });

  it('loop: zero live-deploy-drift facts → ok, fact count carried informationally', () => {
    expect(view.loop.status).toBe('ok');
    expect(view.loop.liveDeployDriftFacts).toBe(0);
    expect(view.loop.factCount).toBe(0);
  });

  it('cron: all four loaded with exit 0 → ok', () => {
    expect(view.cron).toHaveLength(4);
    expect(view.cron.every((c) => c.status === 'ok')).toBe(true);
    expect(view.cron.map((c) => c.name)).toEqual(['self-audit', 'release-pipeline', 'ci-health', 'repo-embed']);
  });

  it('inventory: carries the real channel/package counts', () => {
    expect(view.inventory.integrations).toBe(97);
    expect(view.inventory.packages).toBe(76);
    expect(view.inventory.status).toBe('ok');
  });

  it('surfaces: all five present → ok', () => {
    expect(view.surfaces).toHaveLength(5);
    expect(view.surfaces.every((s) => s.status === 'ok')).toBe(true);
  });

  it('overall: worst of bus/loop/cron → ok when everything is green', () => {
    expect(view.overall).toBe('ok');
  });

  it('carries commit provenance + recent-commits feed + last audit run through', () => {
    expect(view.commit).toBe('72422d45');
    expect(view.branch).toBe('modules-integration');
    expect(view.recentCommits).toHaveLength(1);
    expect(view.lastAuditRun).toBe('2026-07-09T22:24:34Z');
  });
});

describe('deriveControlRoomView — degraded / dirty inputs (honesty gates)', () => {
  it('null snapshot → every tile unknown, never a fabricated ok', () => {
    const view = deriveControlRoomView(null);
    expect(view.bus.status).toBe('unknown');
    expect(view.loop.status).toBe('unknown');
    expect(view.cron).toEqual([]);
    expect(view.surfaces).toEqual([]);
    expect(view.inventory.integrations).toBe(0);
    expect(view.overall).toBe('unknown');
  });

  it('undefined snapshot → same honest-unknown behaviour as null', () => {
    const view = deriveControlRoomView(undefined);
    expect(view.bus.status).toBe('unknown');
    expect(view.commit).toBeNull();
    expect(view.recentCommits).toEqual([]);
  });

  it('empty object snapshot ({}) → every field defaults, no crash', () => {
    const view = deriveControlRoomView({});
    expect(view.bus.status).toBe('unknown');
    expect(view.loop.status).toBe('unknown');
    expect(view.inventory).toMatchObject({ integrations: 0, packages: 0, status: 'ok' });
    expect(view.lastAuditRun).toBeNull();
  });

  it('bus catalog error → unknown, error surfaced as detail', () => {
    const view = deriveControlRoomView({ bus: { catalog: { error: 'ariada-bus-catalog.mjs exited 1' } } });
    expect(view.bus.status).toBe('unknown');
    expect(view.bus.detail).toMatch(/exited 1/);
  });

  it('bus drift (inSync:false) → warn, not fail (a drift is fixable, not an outage)', () => {
    const view = deriveControlRoomView({ bus: { catalog: { packages: 71, inSync: false, drift: 3 } } });
    expect(view.bus.status).toBe('warn');
    expect(view.bus.drift).toBe(3);
  });

  it('live-deploy-drift facts > 0 → loop fails (the loop caught a real mismatch)', () => {
    const view = deriveControlRoomView({ bus: { liveDeployDriftFacts: 2 }, selfRegulatingLoop: { factCount: 5 } });
    expect(view.loop.status).toBe('fail');
    expect(view.loop.liveDeployDriftFacts).toBe(2);
    expect(view.loop.factCount).toBe(5);
  });

  it('selfRegulatingLoop present but facts omitted → empty recentFacts, no crash', () => {
    const view = deriveControlRoomView({ selfRegulatingLoop: { factCount: 3 } });
    expect(view.loop.factCount).toBe(3);
    expect(view.loop.recentFacts).toEqual([]);
  });

  it('selfRegulatingLoop.facts explicitly empty array → recentFacts stays empty', () => {
    const view = deriveControlRoomView({ selfRegulatingLoop: { factCount: 0, facts: [] } });
    expect(view.loop.recentFacts).toEqual([]);
  });

  it('bus missing entirely alongside other real fields → bus unknown, rest still honest', () => {
    const view = deriveControlRoomView({ selfRegulatingLoop: { factCount: 0 }, inventory: { integrations: 4 } });
    expect(view.bus.status).toBe('unknown');
    expect(view.loop.status).toBe('unknown'); // no bus.liveDeployDriftFacts signal either
    expect(view.inventory.integrations).toBe(4);
  });

  it('cron not loaded → fail; loaded with nonzero exit → warn; loaded with null exit → unknown', () => {
    const view = deriveControlRoomView({
      cron: [
        { name: 'self-audit', loaded: false, lastExit: null },
        { name: 'ci-health', loaded: true, lastExit: '1' },
        { name: 'repo-embed', loaded: true, lastExit: null },
      ],
    });
    expect(view.cron[0]).toMatchObject({ name: 'self-audit', status: 'fail', loaded: false });
    expect(view.cron[1]).toMatchObject({ name: 'ci-health', status: 'warn' });
    expect(view.cron[2]).toMatchObject({ name: 'repo-embed', status: 'unknown' });
  });

  it('cron loaded with an empty-string exit code → warn (not "0", not null)', () => {
    const view = deriveControlRoomView({ cron: [{ name: 'ci-health', loaded: true, lastExit: '' }] });
    expect(view.cron[0]).toMatchObject({ status: 'warn', lastExit: '' });
  });

  it('a missing surface → unknown (roadmap gap), never fail', () => {
    const view = deriveControlRoomView({ surfaces: [{ name: 'Shopify (P11)', present: false }] });
    expect(view.surfaces[0]).toMatchObject({ status: 'unknown', present: false });
  });

  it('overall ignores surfaces (a roadmap gap must not redden the whole board)', () => {
    const view = deriveControlRoomView({
      bus: { catalog: { inSync: true }, liveDeployDriftFacts: 0 },
      selfRegulatingLoop: { factCount: 0 },
      surfaces: [{ name: 'WordPress (P12)', present: false }],
    });
    expect(view.overall).toBe('ok');
  });

  it('a failing cron worsens overall even when bus + loop are ok', () => {
    const view = deriveControlRoomView({
      bus: { catalog: { inSync: true }, liveDeployDriftFacts: 0 },
      cron: [{ name: 'self-audit', loaded: false, lastExit: null }],
    });
    expect(view.overall).toBe('fail');
  });

  it('recentCommits non-array input is normalised to an empty array', () => {
    // Snapshot writers can drift; the view must not propagate a malformed shape.
    const view = deriveControlRoomView({ recentCommits: 'not-an-array' as unknown as string[] });
    expect(view.recentCommits).toEqual([]);
  });
});

describe('worstLamp', () => {
  it('ranks fail > warn > unknown > ok', () => {
    expect(worstLamp(['ok', 'warn', 'unknown'])).toBe('warn');
    expect(worstLamp(['ok', 'fail', 'warn'])).toBe('fail');
    expect(worstLamp(['unknown', 'ok'])).toBe('unknown');
    expect(worstLamp([])).toBe('ok');
  });

  it('LAMP_RANK is monotonic with worstLamp ordering', () => {
    expect(LAMP_RANK.fail).toBeGreaterThan(LAMP_RANK.warn);
    expect(LAMP_RANK.warn).toBeGreaterThan(LAMP_RANK.unknown);
    expect(LAMP_RANK.unknown).toBeGreaterThan(LAMP_RANK.ok);
  });
});
