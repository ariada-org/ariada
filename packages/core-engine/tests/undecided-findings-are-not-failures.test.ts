// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Guard: a finding nobody could decide does not make a site fail.
//
// An analyser marks `needsReview` when it could not determine the answer —
// contrast against a background it cannot resolve, for instance. The cross-site
// axis used to treat any finding as a failure, so a site whose only findings
// needed review joined the failing list, and when it was the only site scanned
// the passing list came out empty and the rule was promoted to systemic: the
// strongest statement this engine makes, resting on the weakest evidence it has.
//
// Measured on the project's own site with the published tool: eleven contrast
// findings, every one of them `needsReview` at a confidence of one half,
// reported as a systemic failure. All eleven pass when the ratio is computed in
// a browser — nine at 17.4:1, two at 4.88:1 against a threshold of 4.5. Nothing
// was found to fail; something could not be looked at properly.
//
// This repository already holds the mirror of this rule: a check that cannot
// look must say so rather than report clean. Cannot-decide reported as a
// failure is the same error the other way round, and for a scanner it is the
// worse of the two — somebody who chases eleven phantom failures, finds
// nothing, and decides the tool cries wolf will not read the twelfth report.
//
// What is held:
//   1. a site whose only findings need review is not a failing site, and no
//      rule is called systemic on the strength of them;
//   2. a decided finding still fails, or the fix would have made the engine
//      blind rather than careful;
//   3. an undecided finding on one site and nothing on another is not a
//      divergence either;
//   4. undecided findings stay in the grid — dropping them trades one wrong
//      answer for another, since they are exactly where a person should look.
import { describe, expect, it } from 'vitest';

import type {
  DomainModule,
  ExtractedFeatures,
  PropertySnapshot,
} from '../src/domain-contract.js';
import { runMultiDomainScan } from '../src/multi-domain-scan.js';
import type { Finding } from '../src/types.js';

/** A snapshot with one element, enough for the walker to have something to do. */
function makeSnapshot(url: string): PropertySnapshot {
  return {
    scanId: `scan-${url}`,
    url,
    timestamp: 0,
    html: '',
    headers: {},
    cookies: [],
    networkResources: [],
    axTree: [],
    domOutline: [{ backendNodeId: 1, nodeName: 'P', selector: 'p' }],
    perfMetrics: {},
    timings: { navigationMs: 0, axTreeMs: 0, domMs: 0, totalMs: 0 },
  } as unknown as PropertySnapshot;
}

/** A finding of the shape the accessibility analyser emits. */
function makeFinding(ruleId: string, needsReview: boolean): Finding {
  return {
    id: `${ruleId}-${String(needsReview)}`,
    scanId: 'replaced-by-the-engine',
    domain: 'accessibility',
    ruleId,
    severity: 'serious',
    element: { selector: 'p' },
    message: 'x',
    ...(needsReview ? { needsReview: true, confidence: 0.5 } : {}),
  } as unknown as Finding;
}

/**
 * A domain that returns the findings this case wants, per site. The engine
 * evaluates once per site, so the module counts its calls to know which site it
 * is on — the features carry no url.
 */
function makeDomain(perSite: readonly Finding[][]): DomainModule {
  let call = 0;
  return {
    id: 'accessibility',
    title: 'Accessibility',
    version: '0.0.1',
    extractors: {
      perElement(): void {
        /* nothing to extract; the findings are supplied directly */
      },
    },
    evaluate(_features: ExtractedFeatures): Finding[] {
      const findings = perSite[call] ?? [];
      call += 1;
      return [...findings];
    },
  } as unknown as DomainModule;
}

describe('a finding nobody could decide', () => {
  it('does not make its site fail, nor its rule systemic', async () => {
    const report = await runMultiDomainScan({
      snapshots: [makeSnapshot('https://one.example/')],
      domains: [
        makeDomain([
          [makeFinding('color-contrast', true), makeFinding('color-contrast', true)],
        ]),
      ],
    });

    expect(report.crossSite.systemic).toEqual([]);
    expect(report.crossSite.divergence).toEqual([]);
    // Still visible: this is where a person should look.
    expect(report.grid['https://one.example/']?.['accessibility']).toHaveLength(2);
  });

  it('leaves a decided finding failing, so the engine is careful and not blind', async () => {
    const report = await runMultiDomainScan({
      snapshots: [makeSnapshot('https://one.example/')],
      domains: [makeDomain([[makeFinding('image-alt', false)]])],
    });

    expect(report.crossSite.systemic.map((s) => s.ruleId)).toEqual(['image-alt']);
  });

  it('does not let an undecided finding on one site create a divergence', async () => {
    const report = await runMultiDomainScan({
      snapshots: [makeSnapshot('https://one.example/'), makeSnapshot('https://two.example/')],
      domains: [makeDomain([[makeFinding('color-contrast', true)], []])],
    });

    expect(report.crossSite.divergence).toEqual([]);
    expect(report.crossSite.systemic).toEqual([]);
  });

  it('still reports a divergence when one site really fails and another does not', async () => {
    const report = await runMultiDomainScan({
      snapshots: [makeSnapshot('https://one.example/'), makeSnapshot('https://two.example/')],
      domains: [makeDomain([[makeFinding('image-alt', false)], []])],
    });

    expect(report.crossSite.divergence.map((d) => d.ruleId)).toEqual(['image-alt']);
  });
});
