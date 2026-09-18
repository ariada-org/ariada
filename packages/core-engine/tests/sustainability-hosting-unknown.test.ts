// SPDX-FileCopyrightText: 2026 Alexander Brichkin (Agonist Development AB)
// SPDX-License-Identifier: EUPL-1.2
//
// The carbon estimate turns on one flag nobody in the scanner's path fills. A
// grid factor of 442 against 50 is nearly nine times the carbon for the same
// bytes, so an unanswered question produced the worst number and printed it to
// three decimal places inside a finding that can reach serious severity. A
// figure to three decimals reads as a measurement; this one rested on an
// assumption the reader was never told about.
//
// The estimate still uses the conservative factor — guessing the other way
// would understate. What is held here is that the finding says which it is.

import { describe, expect, it } from 'vitest';

import type { ExtractedFeatures, FeatureSink, PropertySnapshot } from '../src/domain-contract.js';
import { sustainabilityDomain } from '../src/domains/sustainability.js';

// Heavy enough that the rating lands in the band where the finding fires:
// sixty half-megabyte assets is thirty megabytes, comfortably past F.
const heavyResources = Array.from({ length: 60 }, (_, i) => ({
  url: `https://example.com/asset-${i}.png`,
  mimeType: 'image/png',
  size: 500_000,
}));

function snapshot(greenHosting?: boolean): PropertySnapshot {
  const base = {
    scanId: 'test',
    url: 'https://example.com/',
    timestamp: 0,
    html: '<html><body><p>a page</p></body></html>',
    headers: {},
    cookies: [],
    networkResources: heavyResources,
    axTree: [],
    domOutline: [],
    perfMetrics: {},
    timings: { navigationMs: 0, axTreeMs: 0, domMs: 0, totalMs: 0 },
  } as unknown as PropertySnapshot;
  if (greenHosting !== undefined) {
    (base as { originArtifacts?: { greenHosting: boolean } }).originArtifacts = { greenHosting };
  }
  return base;
}

function carbonFinding(greenHosting?: boolean) {
  const docEntries = new Map<string, unknown>();
  const sink: FeatureSink = {
    set(elementKey: string, featureKey: string, value: unknown): void {
      if (elementKey === '') docEntries.set(featureKey, value);
    },
    setScoped(): void {
      /* not used here */
    },
  };
  sustainabilityDomain.extractors.perDocument!(snapshot(greenHosting), sink);
  const features: ExtractedFeatures = { byElement: new Map(), byDocument: docEntries };
  return sustainabilityDomain.evaluate(features).find((f) => f.ruleId === 'wsg-carbon-rating');
}

describe('the carbon estimate says what it rests on', () => {
  it('names the assumption when nothing established the hosting', () => {
    const finding = carbonFinding(undefined);
    expect(finding).toBeDefined();
    expect(finding?.message).toContain('because nothing established whether it is');
  });

  it('says nothing extra when the question was answered', () => {
    for (const answer of [true, false]) {
      const finding = carbonFinding(answer);
      expect(finding).toBeDefined();
      expect(finding?.message).not.toContain('nothing established');
    }
  });

  it('an answered no is not the same as an unanswered question', () => {
    // Both use the same grid factor, so the number is identical and the
    // sentence is the only thing telling them apart.
    expect(carbonFinding(undefined)?.message).not.toBe(carbonFinding(false)?.message);
  });

  it('is the size the world says it is, not a thousand times it', () => {
    // The anchor that keeps the units honest. One megabyte of transfer on a
    // non-green origin costs roughly two tenths of a gram by the Sustainable
    // Web Design model; the formula produced a hundred and eighty-three, and
    // nothing in the suite noticed because every fixture had been derived from
    // the formula. A range rather than a number, because models differ by a
    // factor of two or three and the defect was three orders of magnitude.
    const oneMegabyte = [{ url: 'https://example.com/a.bin', mimeType: 'application/octet-stream', size: 1_000_000 }];
    const docEntries = new Map<string, unknown>();
    const sink: FeatureSink = {
      set(elementKey: string, featureKey: string, value: unknown): void {
        if (elementKey === '') docEntries.set(featureKey, value);
      },
      setScoped(): void {
        /* not used here */
      },
    };
    const snap = snapshot(false);
    (snap as { networkResources: unknown }).networkResources = oneMegabyte;
    sustainabilityDomain.extractors.perDocument!(snap, sink);
    const grams = docEntries.get('sustainability:co2e-grams') as number;
    expect(grams).toBeGreaterThan(0.05);
    expect(grams).toBeLessThan(1);
  });
});
