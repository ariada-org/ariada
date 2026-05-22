// SPDX-License-Identifier: EUPL-1.2
import { describe, it, expect } from 'vitest';

import {
  commitGapStats,
  extractEditHistoryRhythm,
} from '../../src/signals/edit-history-rhythm.js';
import { ALL_AGENTS } from '../../src/types.js';
import { sampleInput, sampleMetadata } from '../helpers.js';

describe('edit-history rhythm signal', () => {
  it('returns zero gap stats when there are no prior commits', () => {
    const { mean_seconds, variance_seconds } = commitGapStats(
      '2026-05-20T12:00:00.000Z',
      [],
    );
    expect(mean_seconds).toBe(0);
    expect(variance_seconds).toBe(0);
  });

  it('returns zero stats when the timestamp is unparseable', () => {
    const { mean_seconds, variance_seconds, n } = commitGapStats(
      'not-a-timestamp',
      [],
    );
    expect(mean_seconds).toBe(0);
    expect(variance_seconds).toBe(0);
    expect(n).toBe(0);
  });

  it('detects short-interval bursts', () => {
    const { mean_seconds, n } = commitGapStats('2026-05-20T12:00:00.000Z', [
      '2026-05-20T11:59:00.000Z',
      '2026-05-20T11:58:00.000Z',
      '2026-05-20T11:57:00.000Z',
    ]);
    expect(n).toBe(3);
    expect(mean_seconds).toBeLessThan(120);
  });

  it('produces zero-sum contributions (per-signal contribution-sum invariant)', () => {
    const contrib = extractEditHistoryRhythm(sampleInput());
    const sum = ALL_AGENTS.reduce(
      (s, a) => s + contrib.contributions_per_agent[a],
      0,
    );
    expect(Math.abs(sum)).toBeLessThan(1e-9);
  });

  it('caps extraction_confidence at 1 on long histories', () => {
    const prior = Array.from({ length: 20 }).map(
      (_, i) =>
        new Date(Date.parse('2026-05-20T10:00:00.000Z') + i * 60_000).toISOString(),
    );
    const contrib = extractEditHistoryRhythm(
      sampleInput({ commit_metadata: sampleMetadata({ prior_commit_timestamps: prior }) }),
    );
    expect(contrib.extraction_confidence).toBe(1);
  });
});
