// SPDX-License-Identifier: EUPL-1.2
// Tests for finding-cluster construction, branch names, PR titles, PR bodies.
import { describe, it, expect } from 'vitest';
import {
  buildFindingClusters,
  buildBranchName,
  buildPrTitle,
  buildPrBody,
  buildRateLimitComment,
  MAX_CLUSTER_LINES,
} from '../src/cluster.js';
import type { LocatedFinding } from '../src/cluster.js';

// Minimal fixture finding
function makeLocatedFinding(overrides: Partial<LocatedFinding> = {}): LocatedFinding {
  return {
    ruleId: 'color-contrast',
    wcagSc: '1.4.3',
    jurisdictionTags: ['WCAG21'],
    severity: 'serious',
    selector: 'button.primary',
    fingerprint: 'a'.repeat(64),
    sourceFilePath: 'src/Button.tsx',
    startLine: 14,
    endLine: 16,
    ...overrides,
  };
}

describe('buildFindingClusters', () => {
  it('returns empty array for no findings', () => {
    expect(buildFindingClusters([])).toEqual([]);
  });

  it('groups findings by ruleId + sourceFilePath + wcagSc', () => {
    const findings: LocatedFinding[] = [
      makeLocatedFinding({ fingerprint: 'a'.repeat(64), startLine: 5, endLine: 6 }),
      makeLocatedFinding({ fingerprint: 'b'.repeat(64), startLine: 8, endLine: 9 }),
    ];
    const clusters = buildFindingClusters(findings);
    // Both have the same rule+file+sc, adjacent enough for one cluster
    expect(clusters.length).toBeGreaterThanOrEqual(1);
  });

  it('separates findings into different clusters when from different files', () => {
    const findings: LocatedFinding[] = [
      makeLocatedFinding({ fingerprint: 'a'.repeat(64), sourceFilePath: 'src/A.tsx' }),
      makeLocatedFinding({ fingerprint: 'b'.repeat(64), sourceFilePath: 'src/B.tsx' }),
    ];
    const clusters = buildFindingClusters(findings);
    expect(clusters.length).toBe(2);
  });

  it('separates findings into different clusters when from different rules', () => {
    const findings: LocatedFinding[] = [
      makeLocatedFinding({ fingerprint: 'a'.repeat(64), ruleId: 'color-contrast' }),
      makeLocatedFinding({ fingerprint: 'b'.repeat(64), ruleId: 'button-name' }),
    ];
    const clusters = buildFindingClusters(findings);
    expect(clusters.length).toBe(2);
  });

  it('splits a group into two clusters when the span exceeds MAX_CLUSTER_LINES', () => {
    const findings: LocatedFinding[] = [
      makeLocatedFinding({ fingerprint: 'a'.repeat(64), startLine: 1, endLine: 2 }),
      makeLocatedFinding({
        fingerprint: 'b'.repeat(64),
        startLine: 1 + MAX_CLUSTER_LINES + 5,
        endLine: 1 + MAX_CLUSTER_LINES + 6,
      }),
    ];
    const clusters = buildFindingClusters(findings);
    expect(clusters.length).toBe(2);
  });

  it('skips findings without a sourceFilePath', () => {
    const findings: LocatedFinding[] = [
      makeLocatedFinding({ fingerprint: 'a'.repeat(64), sourceFilePath: undefined }),
    ];
    expect(buildFindingClusters(findings)).toEqual([]);
  });

  it('cluster includes all fingerprint hashes from the group', () => {
    const findings: LocatedFinding[] = [
      makeLocatedFinding({ fingerprint: 'a'.repeat(64), startLine: 10, endLine: 11 }),
      makeLocatedFinding({ fingerprint: 'b'.repeat(64), startLine: 12, endLine: 13 }),
    ];
    const clusters = buildFindingClusters(findings);
    expect(clusters.length).toBe(1);
    const cluster = clusters[0];
    expect(cluster).toBeDefined();
    expect(cluster?.fingerprintHashes).toContain('a'.repeat(64));
    expect(cluster?.fingerprintHashes).toContain('b'.repeat(64));
  });

  it('cluster startLine and endLine cover the whole group', () => {
    const findings: LocatedFinding[] = [
      makeLocatedFinding({ fingerprint: 'a'.repeat(64), startLine: 5, endLine: 7 }),
      makeLocatedFinding({ fingerprint: 'b'.repeat(64), startLine: 9, endLine: 11 }),
    ];
    const clusters = buildFindingClusters(findings);
    expect(clusters.length).toBe(1);
    const c = clusters[0];
    expect(c).toBeDefined();
    expect(c?.startLine).toBe(5);
    expect(c?.endLine).toBe(11);
  });
});

describe('buildBranchName', () => {
  it('produces a branch matching the expected pattern', () => {
    const cluster = buildFindingClusters([makeLocatedFinding()])[0];
    expect(cluster).toBeDefined();
    if (!cluster) return;
    const branch = buildBranchName(cluster, 'a3f8c12deadbeef');
    expect(branch).toMatch(/^reverter\/fix-/);
    expect(branch).toContain('color-contrast');
    expect(branch).toContain('a3f8c12');
  });

  it('sanitises rule IDs with special characters', () => {
    const cluster = buildFindingClusters([makeLocatedFinding({ ruleId: 'wcag2/2.4.7' })])[0];
    expect(cluster).toBeDefined();
    if (!cluster) return;
    const branch = buildBranchName(cluster, 'deadbeef1234567');
    // Branch starts with "reverter/" prefix (intentional) but the rule slug portion must not contain / or .
    expect(branch).toMatch(/^reverter\/fix-[a-z0-9-]+-[a-f0-9]{7}$/);
    const ruleSlugPart = branch.replace(/^reverter\/fix-/, '').replace(/-[a-f0-9]{7}$/, '');
    expect(ruleSlugPart).not.toContain('/');
    expect(ruleSlugPart).not.toContain('.');
  });
});

describe('buildPrTitle', () => {
  it('follows the Conventional Commits fix(a11y) format', () => {
    const cluster = buildFindingClusters([makeLocatedFinding()])[0];
    expect(cluster).toBeDefined();
    if (!cluster) return;
    const title = buildPrTitle(cluster);
    expect(title).toMatch(/^fix\(a11y\):/);
    expect(title).toContain('color-contrast');
    expect(title).toContain('Button.tsx');
    expect(title).toContain('finding');
  });

  it('uses plural "findings" for more than one', () => {
    const findings: LocatedFinding[] = [
      makeLocatedFinding({ fingerprint: 'a'.repeat(64), startLine: 10, endLine: 11 }),
      makeLocatedFinding({ fingerprint: 'b'.repeat(64), startLine: 12, endLine: 13 }),
    ];
    const cluster = buildFindingClusters(findings)[0];
    expect(cluster).toBeDefined();
    if (!cluster) return;
    const title = buildPrTitle(cluster);
    expect(title).toContain('2 findings');
  });
});

describe('buildPrBody', () => {
  it('contains a draft PR warning', () => {
    const cluster = buildFindingClusters([makeLocatedFinding()])[0];
    expect(cluster).toBeDefined();
    if (!cluster) return;
    const body = buildPrBody({
      cluster,
      tierUsed: 1,
      fixId: 'rvt_fixture_001',
      diff: '-color: \'#aaa\';\n+color: \'#595959\';',
      originalLines: "color: '#aaa';",
      patchedLines: "color: '#595959'; /* contrast ratio 7.0:1 */",
    });
    expect(body).toContain('draft PR');
    expect(body).toContain('Reverter does not auto-merge');
  });

  it('contains the fix ID in a code span', () => {
    const cluster = buildFindingClusters([makeLocatedFinding()])[0];
    expect(cluster).toBeDefined();
    if (!cluster) return;
    const body = buildPrBody({
      cluster,
      tierUsed: 1,
      fixId: 'rvt_fixture_001',
      diff: '',
      originalLines: '',
      patchedLines: '',
    });
    expect(body).toContain('`rvt_fixture_001`');
  });

  it('contains "contrast ratio" in the patched lines', () => {
    const cluster = buildFindingClusters([makeLocatedFinding()])[0];
    expect(cluster).toBeDefined();
    if (!cluster) return;
    const body = buildPrBody({
      cluster,
      tierUsed: 1,
      fixId: 'rvt_fixture_001',
      diff: '',
      originalLines: "color: '#aaa';",
      patchedLines: "color: '#595959'; /* contrast ratio 7.0:1 */",
    });
    expect(body).toContain('contrast ratio');
  });

  it('includes "Triggered by Vercel deployment" when triggeredBy=vercel', () => {
    const cluster = buildFindingClusters([makeLocatedFinding()])[0];
    expect(cluster).toBeDefined();
    if (!cluster) return;
    const body = buildPrBody({
      cluster,
      tierUsed: 1,
      fixId: 'rvt_fixture_001',
      diff: '',
      originalLines: '',
      patchedLines: '',
      triggeredBy: 'vercel',
      deploymentUrl: 'http://localhost:3700',
    });
    expect(body).toContain('Triggered by Vercel deployment');
  });

  it('always uses draft: true header text', () => {
    const cluster = buildFindingClusters([makeLocatedFinding()])[0];
    expect(cluster).toBeDefined();
    if (!cluster) return;
    const body = buildPrBody({
      cluster,
      tierUsed: 0,
      fixId: 'rvt_test',
      diff: '',
      originalLines: '',
      patchedLines: '',
    });
    // Draft PR text must be present
    expect(body).toContain('draft PR');
  });
});

describe('buildRateLimitComment', () => {
  it('contains "daily fix-PR limit" text', () => {
    const comment = buildRateLimitComment('https://example.com/pricing?ref=rate_limit');
    expect(comment).toContain('daily fix-PR limit');
  });

  it('contains "Upgrade to unlock more" link', () => {
    const comment = buildRateLimitComment('https://example.com/pricing?ref=rate_limit');
    expect(comment).toContain('Upgrade to unlock more');
  });
});
