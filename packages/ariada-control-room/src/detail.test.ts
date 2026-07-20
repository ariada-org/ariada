// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { describe, expect, it } from 'vitest';

import { deriveDriftDetail, deriveLoopDetail } from './detail.ts';

const LOOP_FACT = {
  schemaVersion: 1,
  kind: 'content-policy-loop-fact',
  verdict: 'fail',
  finding: {
    ruleId: 'wcag2/2.4.7',
    severity: 'serious',
    selector: 'main > a.skip-link',
    jurisdictionTags: ['EU'],
    fingerprint: 'abc123',
  },
  attribution: {
    findingFingerprint: 'abc123',
    commitSha: '2a0654f1abc',
    author: { name: 'Alexander Brichkin', emailHash: 'deadbeef' },
    posterior: [],
    confidence: 0.82,
  },
  remediation: {
    branchName: 'reverter/wcag2-2-4-7-abc123',
    prTitle: 'Restore visible focus indicator on skip link',
    prBody: 'Draft remediation plan.',
    sourceFilePath: 'apps/ariada-org/src/pages/index.astro',
    startLine: 12,
    endLine: 12,
  },
};

const DRIFT_FACT = {
  kind: 'live-deploy-drift',
  surfaceId: 'ariada-org',
  currentBuildRef: 'dist/index.html',
  liveRef: '.ariada/live-snapshots/ariada-org.html',
  currentBuildHash: 'aaaa',
  liveRenderedHash: 'bbbb',
};

describe('deriveLoopDetail', () => {
  it('null snapshot → unknown status, zero facts, no crash', () => {
    const detail = deriveLoopDetail(null);
    expect(detail.status).toBe('unknown');
    expect(detail.factCount).toBe(0);
    expect(detail.liveDeployDriftFacts).toBeNull();
    expect(detail.recentFacts).toEqual([]);
  });

  it('a real loop fact is projected into a readable summary', () => {
    const detail = deriveLoopDetail({
      selfRegulatingLoop: { factCount: 1, facts: [LOOP_FACT] },
      bus: { liveDeployDriftFacts: 0 },
    });
    expect(detail.status).toBe('ok');
    expect(detail.factCount).toBe(1);
    expect(detail.liveDeployDriftFacts).toBe(0);
    expect(detail.recentFacts).toHaveLength(1);
    expect(detail.recentFacts[0]).toEqual({
      ruleId: 'wcag2/2.4.7',
      severity: 'serious',
      selector: 'main > a.skip-link',
      commitSha: '2a0654f1abc',
      authorName: 'Alexander Brichkin',
      confidence: 0.82,
      prTitle: 'Restore visible focus indicator on skip link',
      branchName: 'reverter/wcag2-2-4-7-abc123',
    });
  });

  it('a malformed fact (not an object) never crashes — every field reads null', () => {
    const detail = deriveLoopDetail({ selfRegulatingLoop: { factCount: 1, facts: ['not-an-object'] } });
    expect(detail.recentFacts).toHaveLength(1);
    expect(detail.recentFacts[0]).toEqual({
      ruleId: null,
      severity: null,
      selector: null,
      commitSha: null,
      authorName: null,
      confidence: null,
      prTitle: null,
      branchName: null,
    });
  });

  it('a partially-shaped fact (missing nested objects) degrades field-by-field, no crash', () => {
    const detail = deriveLoopDetail({ selfRegulatingLoop: { factCount: 1, facts: [{ finding: { ruleId: 'x' } }] } });
    expect(detail.recentFacts[0]).toMatchObject({ ruleId: 'x', commitSha: null, authorName: null });
  });
});

describe('deriveDriftDetail', () => {
  it('null snapshot → unknown status (no signal), zero facts, no crash', () => {
    const detail = deriveDriftDetail(null);
    expect(detail.status).toBe('unknown');
    expect(detail.driftFactCount).toBe(0);
    expect(detail.facts).toEqual([]);
  });

  it('zero drift facts with a real signal present → ok', () => {
    const detail = deriveDriftDetail({ bus: { liveDeployDriftFacts: 0, liveDeployDrift: [] } });
    expect(detail.status).toBe('ok');
    expect(detail.driftFactCount).toBe(0);
  });

  it('a real drift fact is projected into a readable summary and status fails', () => {
    const detail = deriveDriftDetail({ bus: { liveDeployDriftFacts: 1, liveDeployDrift: [DRIFT_FACT] } });
    expect(detail.status).toBe('fail');
    expect(detail.driftFactCount).toBe(1);
    expect(detail.facts).toEqual([
      {
        surfaceId: 'ariada-org',
        currentBuildRef: 'dist/index.html',
        liveRef: '.ariada/live-snapshots/ariada-org.html',
        currentBuildHash: 'aaaa',
        liveRenderedHash: 'bbbb',
      },
    ]);
  });

  it('a malformed drift fact never crashes — every field reads null', () => {
    const detail = deriveDriftDetail({ bus: { liveDeployDriftFacts: 1, liveDeployDrift: [42] } });
    expect(detail.facts[0]).toEqual({
      surfaceId: null,
      currentBuildRef: null,
      liveRef: null,
      currentBuildHash: null,
      liveRenderedHash: null,
    });
  });
});
