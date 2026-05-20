// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

import type { RuleSeverity } from './rules.js';

/**
 * Workspace accessibility score formula (v0.1).
 *
 *     score = 100 − (10·critical + 3·serious + 1·moderate)
 *
 * Clamped to [0, 100]. The formula is the placeholder baseline; a canonical
 * score-engine package is expected to land in a later release.
 */

/**
 *
 */
export interface SeverityCounts {
  readonly critical: number;
  readonly serious: number;
  readonly moderate: number;
  readonly minor: number;
}

/**
 *
 */
export function countBySeverity(severities: readonly RuleSeverity[]): SeverityCounts {
  const counts: { critical: number; serious: number; moderate: number; minor: number } = {
    critical: 0,
    serious: 0,
    moderate: 0,
    minor: 0,
  };
  for (const s of severities) {
    counts[s] += 1;
  }
  return counts;
}

/**
 *
 */
export function computeScore(counts: SeverityCounts): number {
  const raw = 100 - (10 * counts.critical + 3 * counts.serious + 1 * counts.moderate);
  return Math.max(0, Math.min(100, raw));
}

/**
 *
 */
export type ScoreBucket = 'good' | 'warn' | 'bad';

/**
 *
 */
export function scoreBucket(score: number): ScoreBucket {
  if (score >= 90) {
    return 'good';
  }
  if (score >= 70) {
    return 'warn';
  }
  return 'bad';
}

/**
 *
 */
export function statusBarText(score: number, totalFindings: number): string {
  const bucket = scoreBucket(score);
  const glyph = bucket === 'good' ? '✓' : bucket === 'warn' ? '⚠' : '✗';
  const noun = totalFindings === 1 ? 'issue' : 'issues';
  return `${glyph} ariada ${score} · ${totalFindings} ${noun}`;
}
