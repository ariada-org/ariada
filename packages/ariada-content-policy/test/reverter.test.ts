// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

import { describe, expect, it } from 'vitest';

import {
  builtinPacks,
  evaluateContent,
  ossSurfaceProfile,
  type ContentProfile,
  type RulePack,
} from '../src/index.js';
import { buildBaseline, detectRegression, type ReverterBaseline } from '../src/reverter.js';

const run = (content: string, profile = ossSurfaceProfile, packs = builtinPacks) =>
  evaluateContent(content, profile, packs);

describe('reverter — buildBaseline', () => {
  it('records the spans removed between before and after (with literal text)', () => {
    const before = run('see ariada.ai for pricing');
    const after = run('see our site for pricing');
    const baseline = buildBaseline(before, after);
    expect(baseline.removedSpans).toHaveLength(1);
    expect(baseline.removedSpans[0]?.matchedText.toLowerCase()).toBe('ariada.ai');
    expect(baseline.removedSpans[0]?.category).toBe('commercial-crosspromo');
  });

  it('records nothing when nothing was removed', () => {
    const clean = run('a clean line');
    expect(buildBaseline(clean, clean).removedSpans).toHaveLength(0);
  });

  it('deduplicates repeated removed spans', () => {
    const before = run('ariada.ai\nariada.ai again');
    const after = run('clean\nclean again');
    expect(buildBaseline(before, after).removedSpans).toHaveLength(1);
  });

  it('is JSON round-trippable', () => {
    const baseline = buildBaseline(run('ariada.ai'), run('clean'));
    const round = JSON.parse(JSON.stringify(baseline)) as ReverterBaseline;
    expect(round).toEqual(baseline);
  });
});

describe('reverter — detectRegression (THE distinct value: catches a leak the live rule-set forgot)', () => {
  // Build a baseline while the commercial-domain rule is ACTIVE.
  const before = run('see ariada.ai');
  const after = run('see our site');
  const baseline = buildBaseline(before, after);

  it('catches the removed span re-introduced into RAW content, independent of any rule', () => {
    const reintroduced = 'the new copy mentions ariada.ai again';
    const regressions = detectRegression(baseline, reintroduced);
    expect(regressions).toHaveLength(1);
    expect(regressions[0]?.matchedText.toLowerCase()).toBe('ariada.ai');
    expect(regressions[0]?.baselineFingerprint).toBe(baseline.removedSpans[0]?.fingerprint);
  });

  it('CRITICAL — catches the re-introduction even when NO live rule would flag it (retired-rule case)', () => {
    // A plain "run the policy on HEAD" with no matching rule misses it (zero
    // findings); the baseline's remembered span still catches it. This is the
    // distinct reverter value: the baseline remembers what the rule-set forgot.
    const emptyProfile: ContentProfile = { id: 'empty', surface: 'public-oss', packs: ['none'] };
    const emptyPacks: RulePack[] = [];
    const live = evaluateContent('the copy mentions ariada.ai again', emptyProfile, emptyPacks);
    expect(live.result).toBe('pass'); // the rule-less live gate misses it
    const regressions = detectRegression(baseline, 'the copy mentions ariada.ai again');
    expect(regressions).toHaveLength(1);
    expect(regressions[0]?.category).toBe('commercial-crosspromo');
  });

  it('reports the line where the removed span reappeared', () => {
    const regressions = detectRegression(baseline, 'line one\nline two\nhere is ariada.ai');
    expect(regressions[0]?.line).toBe(3);
  });

  it('ignores content where no removed span reappears', () => {
    expect(detectRegression(baseline, 'a totally clean paragraph')).toHaveLength(0);
  });

  it('empty baseline detects nothing', () => {
    const empty: ReverterBaseline = { surface: 'public-oss', removedSpans: [] };
    expect(detectRegression(empty, 'see ariada.ai')).toHaveLength(0);
  });
});
