// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
/**
 * Pure scoring helper — locked formula shared across the draculascan surface.
 * Changing this breaks scorecard stability downstream.
 */
export interface Counts {
  critical: number;
  serious: number;
  moderate: number;
  minor: number;
}

/**
 *
 */
export function scoreFromCounts(c: Counts): number {
  return Math.max(
    0,
    100 - (c.critical * 10 + c.serious * 5 + c.moderate * 2 + c.minor * 1),
  );
}

/**
 *
 */
export type ScoreBand = 'excellent' | 'good' | 'fair' | 'poor' | 'critical';

/**
 *
 */
export function bandFromScore(score: number): ScoreBand {
  if (score >= 90) return 'excellent';
  if (score >= 70) return 'good';
  if (score >= 50) return 'fair';
  if (score >= 30) return 'poor';
  return 'critical';
}
