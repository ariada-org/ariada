// SPDX-License-Identifier: EUPL-1.2
//
// Property: fingerprinting is deterministic — same finding bytes always
// produce the same 64-char hex hash, no matter how many times we hash.

import { describe, it, expect } from 'vitest';

import {
  computeFindingFingerprint,
  type Finding,
} from '../../src/fingerprint.js';

const SEVERITIES = ['critical', 'serious', 'moderate', 'minor'] as const;
const TAGS = ['WCAG2.2-AA', 'EAA', 'ADA', 'Section508'];

function randInt(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s;
  };
}

function arbitraryFinding(rng: () => number): Finding {
  const tagCount = rng() % 4;
  const tags = new Set<string>();
  for (let i = 0; i < tagCount; i++) {
    const tag = TAGS[rng() % TAGS.length];
    if (tag) tags.add(tag);
  }
  const sev = SEVERITIES[rng() % SEVERITIES.length] ?? 'minor';
  return {
    ruleId: `wcag2/${(rng() % 9) + 1}.${(rng() % 9) + 1}.${(rng() % 9) + 1}`,
    wcagSc: rng() % 2 === 0 ? `${(rng() % 4) + 1}.${(rng() % 4) + 1}.${(rng() % 4) + 1}` : null,
    jurisdictionTags: [...tags],
    severity: sev,
    selector: `main > div.col-${rng() % 12}`,
    axTreeRole: rng() % 2 === 0 ? 'img' : 'button',
    axTreeName: rng() % 2 === 0 ? `Label ${rng() % 100}` : null,
  };
}

describe('fingerprint determinism (property)', () => {
  it('1000 random findings hash deterministically across two passes', () => {
    const rng = randInt(42);
    let mismatches = 0;
    for (let i = 0; i < 1000; i++) {
      const f = arbitraryFinding(rng);
      const a = computeFindingFingerprint(f);
      const b = computeFindingFingerprint(f);
      if (a !== b) mismatches++;
      expect(a).toMatch(/^[0-9a-f]{64}$/);
    }
    expect(mismatches).toBe(0);
  });

  it('1000 random findings produce stable hash when tags re-ordered', () => {
    const rng = randInt(99);
    for (let i = 0; i < 1000; i++) {
      const f = arbitraryFinding(rng);
      const reordered: Finding = {
        ...f,
        jurisdictionTags: [...f.jurisdictionTags].reverse(),
      };
      const a = computeFindingFingerprint(f);
      const b = computeFindingFingerprint(reordered);
      expect(a).toBe(b);
    }
  });
});
