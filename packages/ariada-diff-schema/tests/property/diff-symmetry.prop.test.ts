// SPDX-License-Identifier: EUPL-1.2
//
// Property: swapping head + base swaps `new` ↔ `resolved`; `pre_existing`
// is unchanged. The OSS stub classifier is equality-only.

import { describe, it, expect } from 'vitest';

import {
  computeFindingFingerprint,
  type Finding,
} from '../../src/fingerprint.js';

function mkFinding(ruleId: string, selector: string): Finding {
  return {
    ruleId,
    jurisdictionTags: ['WCAG2.2-AA'],
    severity: 'serious',
    selector,
  };
}

interface ClassifyResult {
  newSet: Set<string>;
  preExisting: Set<string>;
  resolved: Set<string>;
}

function classify(head: Finding[], base: Finding[]): ClassifyResult {
  const headFps = head.map((f) => computeFindingFingerprint(f));
  const baseFps = base.map((f) => computeFindingFingerprint(f));
  const headSet = new Set(headFps);
  const baseSet = new Set(baseFps);
  const newSet = new Set<string>();
  const preExisting = new Set<string>();
  const resolved = new Set<string>();
  for (const fp of headSet) {
    if (baseSet.has(fp)) preExisting.add(fp);
    else newSet.add(fp);
  }
  for (const fp of baseSet) {
    if (!headSet.has(fp)) resolved.add(fp);
  }
  return { newSet, preExisting, resolved };
}

describe('diff symmetry (property)', () => {
  it('swapping head + base swaps new ↔ resolved', () => {
    const head: Finding[] = [
      mkFinding('wcag2/1.1.1', 'img.a'),
      mkFinding('wcag2/1.4.3', 'p.b'),
    ];
    const base: Finding[] = [
      mkFinding('wcag2/1.1.1', 'img.a'),
      mkFinding('wcag2/2.4.7', 'a.c'),
    ];

    const ab = classify(head, base);
    const ba = classify(base, head);

    const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
    expect([...ab.newSet].sort(cmp)).toEqual([...ba.resolved].sort(cmp));
    expect([...ab.resolved].sort(cmp)).toEqual([...ba.newSet].sort(cmp));
    expect([...ab.preExisting].sort(cmp)).toEqual([...ba.preExisting].sort(cmp));
  });

  it('100 random pairs satisfy the symmetry invariant', () => {
    let s = 7;
    const rng = (): number => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s;
    };
    for (let i = 0; i < 100; i++) {
      const headSize = (rng() % 10) + 1;
      const baseSize = (rng() % 10) + 1;
      const head: Finding[] = [];
      const base: Finding[] = [];
      for (let k = 0; k < headSize; k++) {
        head.push(mkFinding(`wcag2/r${rng() % 5}`, `div.h${rng() % 5}`));
      }
      for (let k = 0; k < baseSize; k++) {
        base.push(mkFinding(`wcag2/r${rng() % 5}`, `div.h${rng() % 5}`));
      }
      const ab = classify(head, base);
      const ba = classify(base, head);
      const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
      expect([...ab.newSet].sort(cmp)).toEqual([...ba.resolved].sort(cmp));
      expect([...ab.preExisting].sort(cmp)).toEqual([...ba.preExisting].sort(cmp));
    }
  });
});
