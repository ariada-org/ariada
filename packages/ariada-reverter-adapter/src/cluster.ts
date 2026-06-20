// SPDX-License-Identifier: EUPL-1.2
// Copyright Agonist Development AB — see NOTICE
//
// Finding-cluster construction.
//
// A finding cluster is a set of findings sharing the same rule, source file,
// and WCAG success criterion, grouped into contiguous-line blocks of at most
// MAX_CLUSTER_LINES lines. This keeps each fix-PR reviewable in under five
// minutes.

import type { FindingWithFingerprint } from '@ariada-org/diff-schema';
import type { FindingCluster } from './types/cascade.js';

/** Maximum source-line span for a single cluster. */
export const MAX_CLUSTER_LINES = 20;

/** Maximum number of clusters produced from one set of findings. */
export const MAX_CLUSTERS_PER_SCAN = 50;

/**
 * A finding extended with source-location information provided by the scanner.
 * The scanner emits line numbers alongside the standard finding fields.
 */
export interface LocatedFinding extends FindingWithFingerprint {
  /** Relative path to the source file (not the DOM URL). */
  sourceFilePath?: string;
  /** 1-based start line in the source file. */
  startLine?: number;
  /** 1-based end line in the source file. */
  endLine?: number;
}

/**
 * Group an array of located findings into clusters suitable for one fix-PR each.
 *
 * Grouping rules:
 *   1. Same `ruleId` + same `sourceFilePath` + same `wcagSc` → candidate cluster.
 *   2. Within that group, findings are sorted by `startLine`.
 *   3. Contiguous findings are merged into a block while the span stays ≤ MAX_CLUSTER_LINES.
 *   4. At most MAX_CLUSTERS_PER_SCAN clusters are returned (excess are silently dropped).
 *   5. Findings without a `sourceFilePath` are skipped (they cannot be patched).
 */
export function buildFindingClusters(findings: LocatedFinding[]): FindingCluster[] {
  // Group by ruleId + sourceFilePath + wcagSc
  const groups = new Map<string, LocatedFinding[]>();

  for (const f of findings) {
    if (!f.sourceFilePath) continue;
    const key = `${f.ruleId}|${f.sourceFilePath}|${f.wcagSc ?? ''}`;
    const bucket = groups.get(key);
    if (bucket) {
      bucket.push(f);
    } else {
      groups.set(key, [f]);
    }
  }

  const clusters: FindingCluster[] = [];

  for (const [, group] of groups) {
    if (clusters.length >= MAX_CLUSTERS_PER_SCAN) break;

    // Sort by startLine; put findings without a line at the end
    const sorted = [...group].sort((a, b) => (a.startLine ?? Infinity) - (b.startLine ?? Infinity));

    // Build contiguous blocks
    let blockStart: number | undefined;
    let blockEnd: number | undefined;
    let blockFingerprints: string[] = [];

    const flush = (blockFindingsSlice: LocatedFinding[]): void => {
      if (blockFindingsSlice.length === 0) return;
      const first = blockFindingsSlice[0];
      if (!first) return;
      clusters.push({
        ruleId: first.ruleId,
        wcagSc: first.wcagSc ?? '',
        sourceFilePath: first.sourceFilePath ?? '',
        fingerprintHashes: blockFindingsSlice.map((f) => f.fingerprint),
        startLine: blockStart ?? 1,
        endLine: blockEnd ?? 1,
        severity: first.severity,
      });
    };

    let blockSlice: LocatedFinding[] = [];

    for (const f of sorted) {
      const fStart = f.startLine ?? 1;
      const fEnd = f.endLine ?? fStart;

      if (blockStart === undefined) {
        // First finding in this group
        blockStart = fStart;
        blockEnd = fEnd;
        blockFingerprints = [f.fingerprint];
        blockSlice = [f];
      } else if (
        blockEnd !== undefined &&
        fStart <= blockEnd + MAX_CLUSTER_LINES &&
        fEnd - blockStart <= MAX_CLUSTER_LINES
      ) {
        // Still within the same block
        blockEnd = Math.max(blockEnd, fEnd);
        blockFingerprints.push(f.fingerprint);
        blockSlice.push(f);
      } else {
        // Start a new block
        flush(blockSlice);
        if (clusters.length >= MAX_CLUSTERS_PER_SCAN) break;
        blockStart = fStart;
        blockEnd = fEnd;
        blockFingerprints = [f.fingerprint];
        blockSlice = [f];
      }
    }

    flush(blockSlice);
  }

  return clusters;
}

/**
 * Build a descriptive branch name for a fix-PR from a cluster and commit SHA.
 * Format: `reverter/fix-<rule-slug>-<7-char-sha>`
 */
export function buildBranchName(cluster: FindingCluster, sourceSha: string): string {
  const ruleSlug = cluster.ruleId
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  const shortSha = sourceSha.slice(0, 7);
  return `reverter/fix-${ruleSlug}-${shortSha}`;
}

/**
 * Build the title for a fix-PR following the Conventional Commits convention.
 * Format: `fix(a11y): <rule-id> in <filename> (<N> finding(s))`
 */
export function buildPrTitle(cluster: FindingCluster): string {
  const filename = cluster.sourceFilePath.split('/').pop() ?? cluster.sourceFilePath;
  const count = cluster.fingerprintHashes.length;
  return `fix(a11y): ${cluster.ruleId} in ${filename} (${count} finding${count === 1 ? '' : 's'})`;
}

/**
 * Build the markdown body for a fix-PR. Includes:
 *   - Finding table (rule, WCAG SC, severity, line range)
 *   - Cascade tier used
 *   - Fix ID (audit trail)
 *   - Before/after evidence panel
 *   - Mandatory draft-PR notice
 */
export function buildPrBody(options: {
  cluster: FindingCluster;
  tierUsed: 0 | 1 | 2 | 3;
  fixId: string;
  diff: string;
  originalLines: string;
  patchedLines: string;
  triggeredBy?: 'github' | 'vercel';
  deploymentUrl?: string;
}): string {
  const { cluster, tierUsed, fixId, diff: _diff, originalLines, patchedLines, triggeredBy, deploymentUrl } = options;
  const filename = cluster.sourceFilePath.split('/').pop() ?? cluster.sourceFilePath;
  const tierLabels = ['T0 deterministic', 'T1 fast LLM', 'T2 Sonnet', 'T3 Opus'] as const;
  const tierLabel = tierLabels[tierUsed] ?? 'T0 deterministic';
  const vercelNote =
    triggeredBy === 'vercel' && deploymentUrl
      ? `\n\n> Triggered by Vercel deployment: ${deploymentUrl}`
      : '';

  return `## Reverter accessibility fix${vercelNote}

| Finding | Rule | WCAG SC | Severity | Lines |
|---|---|---|---|---|
| 1 | ${cluster.ruleId} | ${cluster.wcagSc} | ${cluster.severity} | ${cluster.startLine}–${cluster.endLine} |

**Cascade tier used:** ${tierLabel}
**Fix ID:** \`${fixId}\` (for audit trail)

### Before / after

<details>
<summary>${filename} lines ${cluster.startLine}–${cluster.endLine}</summary>

**Before:**
\`\`\`
${originalLines}
\`\`\`

**After:**
\`\`\`
${patchedLines}
\`\`\`

</details>

---
⚠ **This is a draft PR authored by Reverter.** Review the diff before merging.
Reverter does not auto-merge. This PR was opened by the Reverter integration. Merge only after reviewing the diff.`;
}

/**
 * Build the rate-limit comment body posted on the triggering PR
 * when the daily fix-PR cap is reached.
 */
export function buildRateLimitComment(upgradeCta: string): string {
  return `Reverter reached the daily fix-PR limit for your plan. [Upgrade to unlock more →](${upgradeCta})`;
}
